import { createHmac } from "node:crypto";

import { and, eq, lte, or, sql } from "drizzle-orm";

import { db } from "@acme/db/client";
import { outboxEvent, subscription, webhookDelivery } from "@acme/db/schema";

import type { EventEnvelope } from "./schemas.js";

export interface DeliverOptions {
  maxAttempts?: number;
  timeoutMs?: number;
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

  const matches = subs.filter((s) =>
    matchesFilter(s.eventFilter, envelope),
  );

  if (matches.length === 0) return 0;

  await db.insert(webhookDelivery).values(
    matches.map((s) => ({
      subscriptionId: s.id,
      outboxEventId: envelope.id,
      status: "pending" as const,
      nextRetryAt: new Date(),
    })),
  );

  return matches.length;
}

/**
 * Claim and deliver a single pending webhook. Returns `null` when the queue
 * is empty, otherwise the result of the HTTP call for logging.
 */
export async function deliverNext(
  options: DeliverOptions = {},
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

  const now = new Date();
  const claim = await db
    .select({
      deliveryId: webhookDelivery.id,
      subscriptionId: webhookDelivery.subscriptionId,
      outboxEventId: webhookDelivery.outboxEventId,
      attempts: webhookDelivery.attempts,
      url: subscription.url,
      secret: subscription.secret,
      payload: outboxEvent.payload,
      eventType: outboxEvent.eventType,
      organizationId: outboxEvent.organizationId,
      eventId: outboxEvent.id,
    })
    .from(webhookDelivery)
    .innerJoin(subscription, eq(subscription.id, webhookDelivery.subscriptionId))
    .innerJoin(outboxEvent, eq(outboxEvent.id, webhookDelivery.outboxEventId))
    .where(
      and(
        eq(webhookDelivery.status, "pending"),
        or(
          sql`${webhookDelivery.nextRetryAt} IS NULL`,
          lte(webhookDelivery.nextRetryAt, now),
        ),
      ),
    )
    .orderBy(webhookDelivery.nextRetryAt)
    .limit(1);

  const row = claim[0];
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
      })
      .where(eq(webhookDelivery.id, row.deliveryId));
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
    })
    .where(eq(webhookDelivery.id, row.deliveryId));

  return {
    deliveryId: row.deliveryId,
    subscriptionId: row.subscriptionId,
    status: isDlq ? "dlq" : "failed",
    responseStatus,
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
