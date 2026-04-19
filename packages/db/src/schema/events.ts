import { sql } from "drizzle-orm";
import { index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";

import { organization } from "./identity.js";

export const outboxEvent = pgTable(
  "outbox_event",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    organizationId: t
      .uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    aggregateType: t.varchar({ length: 64 }).notNull(),
    aggregateId: t.varchar({ length: 64 }).notNull(),
    eventType: t.varchar({ length: 128 }).notNull(),
    payload: t.jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    publishedAt: t.timestamp({ withTimezone: true }),
    claimedAt: t.timestamp({ withTimezone: true }),
    claimedBy: t.varchar({ length: 128 }),
    attempts: t.integer().notNull().default(0),
    lastError: t.text(),
  }),
  (table) => [
    index("outbox_unpublished_idx")
      .on(table.createdAt)
      .where(sql`published_at IS NULL`),
    index("outbox_aggregate_idx").on(table.aggregateType, table.aggregateId),
  ],
);

export const subscription = pgTable(
  "subscription",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    organizationId: t
      .uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    url: t.text().notNull(),
    secret: t.text().notNull(),
    eventFilter: t
      .jsonb()
      .$type<{ eventTypes: string[]; projectIds?: string[] }>()
      .notNull(),
    active: t.boolean().notNull().default(true),
    description: t.text(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => [
    index("subscription_org_active_idx").on(
      table.organizationId,
      table.active,
    ),
  ],
);

export const webhookDelivery = pgTable(
  "webhook_delivery",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    subscriptionId: t
      .uuid()
      .notNull()
      .references(() => subscription.id, { onDelete: "cascade" }),
    outboxEventId: t
      .uuid()
      .notNull()
      .references(() => outboxEvent.id, { onDelete: "cascade" }),
    status: t
      .varchar({
        length: 16,
        enum: ["pending", "delivered", "failed", "dlq"],
      })
      .notNull()
      .default("pending"),
    responseStatus: t.integer(),
    lastError: t.text(),
    attempts: t.integer().notNull().default(0),
    nextRetryAt: t.timestamp({ withTimezone: true }),
    claimedAt: t.timestamp({ withTimezone: true }),
    claimedBy: t.varchar({ length: 128 }),
    deliveredAt: t.timestamp({ withTimezone: true }),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => [
    index("delivery_status_retry_idx").on(table.status, table.nextRetryAt),
    index("delivery_subscription_idx").on(table.subscriptionId),
    uniqueIndex("delivery_subscription_event_uniq").on(
      table.subscriptionId,
      table.outboxEventId,
    ),
  ],
);
