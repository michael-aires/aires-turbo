import { createHmac } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@acme/db/client";
import { subscription, webhookDelivery } from "@acme/db/schema";

import type { EventEnvelope } from "./schemas";

export interface DeliverOptions {
  maxAttempts?: number;
  timeoutMs?: number;
  consumerId: string;
  claimTtlMs?: number;
}

/**
 * Fan out a single envelope to every matching subscription. Creates a
 * `webhook_delivery` row per subscription so retries are durable.
 */
export async function fanOut(envelope: EventEnvelope): Promise<number> {
  const subs = await db
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.organizationId, envelope.organizationId),
        eq(subscription.active, true),
      ),
    );

  const matches = subs.filter((s) => matchesFilter(s.eventFilter, envelope));
  if (matches.length === 0) return 0;

  await db
    .insert(webhookDelivery)
    .values(
      matches.map((s) => ({
        subscriptionId: s.id,
        outboxEventId: envelope.id,
        status: "pending" as const,
        nextRetryAt: new Date(),
      })),
    )
    .onConflictDoNothing({
      target: [webhookDelivery.subscriptionId, webhookDelivery.outboxEventId],
    });

  return matches.length;
}

/**
 * Claim and deliver a single pending webhook. Returns `null` when the queue
 * is empty, otherwise the result of the HTTP call for logging.
 */
export async function deliverNext(
  options: DeliverOptions,
): Promise<
  | null
  | {
      deliveryId: string;
      subscriptionId: string;
      status: "delivered" | "failed" | "dlq";
      responseStatus?: number;
    }
> {
  const maxAttempts = options.maxAttempts ?? 8;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const claimTtlMs = options.claimTtlMs ?? 30_000;

  const row = await claimNextDelivery({
    consumerId: options.consumerId,
    claimTtlMs,
  });
  if (!row) return null;

  const body = JSON.stringify({
    id: row.eventId,
    type: row.eventType,
    organizationId: row.organizationId,
    payload: row.payload,
  });
  const signature = createHmac("sha256", row.secret).update(body).digest("hex");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let responseStatus: number | undefined;
  let lastError: string | undefined;
  let ok = false;

  try {
    const response = await fetch(row.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-aires-event": row.eventType,
        "x-aires-signature": `sha256=${signature}`,
        "x-aires-delivery-id": row.deliveryId,
      },
      body,
      signal: controller.signal,
    });
    responseStatus = response.status;
    ok = response.ok;
    if (!ok) {
      lastError = `http ${response.status}`;
    }
  } catch (error) {
    lastError =
      error instanceof Error ? error.message : "unknown delivery error";
  } finally {
    clearTimeout(timer);
  }

  if (ok) {
    await db
      .update(webhookDelivery)
      .set({
        status: "delivered",
        responseStatus,
        deliveredAt: new Date(),
        claimedAt: null,
        claimedBy: null,
      })
      .where(
        and(
          eq(webhookDelivery.id, row.deliveryId),
          eq(webhookDelivery.claimedBy, options.consumerId),
        ),
      );
    return {
      deliveryId: row.deliveryId,
      subscriptionId: row.subscriptionId,
      status: "delivered",
      responseStatus,
    };
  }

  const attempts = row.attempts + 1;
  const isDlq = attempts >= maxAttempts;
  const backoffMs = Math.min(
    60_000 * 60 * 24,
    2 ** attempts * 1_000 + Math.random() * 1_000,
  );

  await db
    .update(webhookDelivery)
    .set({
      status: isDlq ? "dlq" : "pending",
      responseStatus,
      attempts,
      lastError,
      nextRetryAt: isDlq ? null : new Date(Date.now() + backoffMs),
      claimedAt: null,
      claimedBy: null,
    })
    .where(
      and(
        eq(webhookDelivery.id, row.deliveryId),
        eq(webhookDelivery.claimedBy, options.consumerId),
      ),
    );

  return {
    deliveryId: row.deliveryId,
    subscriptionId: row.subscriptionId,
    status: isDlq ? "dlq" : "failed",
    responseStatus,
  };
}

async function claimNextDelivery(options: {
  consumerId: string;
  claimTtlMs: number;
}): Promise<
  | undefined
  | {
      deliveryId: string;
      subscriptionId: string;
      attempts: number;
      url: string;
      secret: string;
      payload: Record<string, unknown>;
      eventType: string;
      organizationId: string;
      eventId: string;
    }
> {
  const rows = (await db.execute(sql`
    with next_delivery as (
      select wd.id
      from webhook_delivery wd
      where wd.status = 'pending'
        and (wd.next_retry_at is null or wd.next_retry_at <= now())
        and (
          wd.claimed_at is null
          or wd.claimed_at < now() - (${options.claimTtlMs} * interval '1 millisecond')
        )
      order by wd.next_retry_at nulls first, wd.created_at
      limit 1
      for update skip locked
    ),
    claimed as (
      update webhook_delivery wd
      set claimed_at = now(),
          claimed_by = ${options.consumerId}
      from next_delivery
      where wd.id = next_delivery.id
      returning
        wd.id,
        wd.subscription_id,
        wd.outbox_event_id,
        wd.attempts
    )
    select
      claimed.id as delivery_id,
      claimed.subscription_id,
      claimed.attempts,
      s.url,
      s.secret,
      oe.payload,
      oe.event_type,
      oe.organization_id,
      oe.id as event_id
    from claimed
    inner join subscription s on s.id = claimed.subscription_id
    inner join outbox_event oe on oe.id = claimed.outbox_event_id;
  `)) as unknown as {
    delivery_id: string;
    subscription_id: string;
    attempts: number;
    url: string;
    secret: string;
    payload: Record<string, unknown>;
    event_type: string;
    organization_id: string;
    event_id: string;
  }[];

  const row = rows[0];
  if (!row) return undefined;

  return {
    deliveryId: row.delivery_id,
    subscriptionId: row.subscription_id,
    attempts: row.attempts,
    url: row.url,
    secret: row.secret,
    payload: row.payload,
    eventType: row.event_type,
    organizationId: row.organization_id,
    eventId: row.event_id,
  };
}

function matchesFilter(
  filter: { eventTypes: string[]; projectIds?: string[] },
  envelope: EventEnvelope,
): boolean {
  const typeOk =
    filter.eventTypes.length === 0 ||
    filter.eventTypes.includes("*") ||
    filter.eventTypes.includes(envelope.type);
  if (!typeOk) return false;

  if (!filter.projectIds || filter.projectIds.length === 0) return true;
  const projectId = (envelope.payload as { projectId?: string }).projectId;
  return projectId ? filter.projectIds.includes(projectId) : false;
}
