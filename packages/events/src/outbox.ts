import { eq, sql } from "drizzle-orm";

import { db } from "@acme/db/client";
import { outboxEvent } from "@acme/db/schema";

import { EventEnvelope, payloadSchemaForEvent } from "./schemas.js";
import type { EventType } from "./schemas.js";

export interface PublishInput {
  organizationId: string;
  eventType: EventType;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  actor: { type: "user" | "agent" | "system"; id: string };
}

/**
 * Either the root `db` or a transaction handle (`tx`) — both expose the subset
 * of query builders we need (`insert`, `update`, `select`). Using a structural
 * type keeps callers free to pass either without drizzle's generic mismatch.
 */
export type DbOrTx = Pick<typeof db, "insert" | "update" | "select">;

/**
 * Transactional outbox publisher. Caller MUST invoke inside a domain-write
 * transaction (`db.transaction(async (tx) => { ... publish(tx, ...) })`) so
 * the event only exists if the domain row committed. A background dispatcher
 * reads `outbox_event WHERE published_at IS NULL` and pushes to Redis Streams.
 */
export async function publish(
  tx: DbOrTx,
  input: PublishInput,
): Promise<string> {
  const schema = payloadSchemaForEvent[input.eventType];
  schema.parse(input.payload);

  const [row] = await tx
    .insert(outboxEvent)
    .values({
      organizationId: input.organizationId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload: { actor: input.actor, ...input.payload },
    })
    .returning({ id: outboxEvent.id });

  if (!row) throw new Error("failed to insert outbox event");
  return row.id;
}

/**
 * Dispatcher pulls a batch of unpublished rows, hands them to `sink`, and
 * marks them published on success. Sink returns failed IDs for retry.
 */
export async function drainOutbox(options: {
  batchSize?: number;
  consumerId: string;
  claimTtlMs?: number;
  sink: (rows: OutboxRow[]) => Promise<{ failedIds: string[] }>;
}): Promise<{ processed: number; failed: number }> {
  const batchSize = options.batchSize ?? 100;
  const rows = await claimOutboxRows({
    batchSize,
    consumerId: options.consumerId,
    claimTtlMs: options.claimTtlMs ?? 30_000,
  });

  if (rows.length === 0) return { processed: 0, failed: 0 };

  const { failedIds } = await options.sink(
    rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      aggregateType: r.aggregateType,
      aggregateId: r.aggregateId,
      eventType: r.eventType,
      payload: r.payload,
      createdAt: r.createdAt,
    })),
  );

  const failedSet = new Set(failedIds);
  const successIds = rows.filter((r) => !failedSet.has(r.id)).map((r) => r.id);

  if (successIds.length) {
    await db
      .update(outboxEvent)
      .set({
        publishedAt: sql`now()`,
        claimedAt: null,
        claimedBy: null,
      })
      .where(
        sql`id = ANY(${successIds}::uuid[]) and claimed_by = ${options.consumerId}`,
      );
  }

  if (failedIds.length) {
    await db
      .update(outboxEvent)
      .set({
        attempts: sql`attempts + 1`,
        lastError: "dispatcher reported failure",
        claimedAt: null,
        claimedBy: null,
      })
      .where(
        sql`id = ANY(${failedIds}::uuid[]) and claimed_by = ${options.consumerId}`,
      );
  }

  return { processed: successIds.length, failed: failedIds.length };
}

export interface OutboxRow {
  id: string;
  organizationId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

async function claimOutboxRows(options: {
  batchSize: number;
  consumerId: string;
  claimTtlMs: number;
}): Promise<OutboxRow[]> {
  const rows = (await db.execute(sql`
    with next_rows as (
      select id
      from outbox_event
      where published_at is null
        and (
          claimed_at is null
          or claimed_at < now() - (${options.claimTtlMs} * interval '1 millisecond')
        )
      order by created_at
      limit ${options.batchSize}
      for update skip locked
    )
    update outbox_event as oe
    set claimed_at = now(),
        claimed_by = ${options.consumerId}
    from next_rows
    where oe.id = next_rows.id
    returning
      oe.id,
      oe.organization_id,
      oe.aggregate_type,
      oe.aggregate_id,
      oe.event_type,
      oe.payload,
      oe.created_at;
  `)) as unknown as {
    id: string;
    organization_id: string;
    aggregate_type: string;
    aggregate_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    created_at: Date;
  }[];

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    payload: row.payload,
    createdAt: row.created_at,
  }));
}

/** Convert a DB row into the public event envelope. */
export function toEnvelope(row: OutboxRow): EventEnvelope {
  const envelope: EventEnvelope = {
    id: row.id,
    type: row.eventType,
    organizationId: row.organizationId,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    createdAt: row.createdAt.toISOString(),
    payload: row.payload,
    actor:
      (row.payload as { actor?: EventEnvelope["actor"] }).actor ?? {
        type: "system",
        id: "system",
      },
  };
  return EventEnvelope.parse(envelope);
}

// expose `eq` for callers that want to revoke a specific row.
export { eq };
