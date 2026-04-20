import { index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { user } from "../auth-schema";
import { agent, organization, project } from "./identity";

export const contact = pgTable(
  "contact",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    organizationId: t
      .uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: t
      .uuid()
      .references(() => project.id, { onDelete: "set null" }),
    email: t.varchar({ length: 320 }),
    phone: t.varchar({ length: 32 }),
    firstName: t.varchar({ length: 128 }),
    lastName: t.varchar({ length: 128 }),
    source: t.varchar({ length: 64 }),
    status: t.varchar({ length: 32 }).notNull().default("new"),
    custom: t.jsonb().$type<Record<string, unknown>>().notNull().default({}),
    pxpContactId: t.text(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  }),
  (table) => [
    index("contact_org_email_idx").on(table.organizationId, table.email),
    index("contact_project_idx").on(table.projectId),
    index("contact_pxp_id_idx").on(table.pxpContactId),
  ],
);

export const CreateContactSchema = createInsertSchema(contact, {
  email: z.string().email().max(320).optional(),
  phone: z.string().max(32).optional(),
  firstName: z.string().max(128).optional(),
  lastName: z.string().max(128).optional(),
  source: z.string().max(64).optional(),
  status: z.string().max(32).optional(),
  custom: z.record(z.string(), z.unknown()).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  pxpContactId: true,
});

export const activity = pgTable(
  "activity",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    organizationId: t
      .uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: t
      .uuid()
      .references(() => project.id, { onDelete: "set null" }),
    contactId: t
      .uuid()
      .references(() => contact.id, { onDelete: "cascade" }),
    kind: t
      .varchar({
        length: 32,
        enum: ["call", "email", "sms", "note", "meeting", "visit", "task"],
      })
      .notNull(),
    direction: t.varchar({ length: 16, enum: ["inbound", "outbound"] }),
    actorType: t
      .varchar({ length: 16, enum: ["user", "agent", "system"] })
      .notNull(),
    actorId: t.text().notNull(),
    occurredAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .notNull(),
    summary: t.text(),
    payload: t
      .jsonb()
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => [
    index("activity_contact_occurred_idx").on(
      table.contactId,
      table.occurredAt,
    ),
    index("activity_org_kind_idx").on(table.organizationId, table.kind),
  ],
);

export const CreateActivitySchema = createInsertSchema(activity, {
  summary: z.string().max(2000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const communication = pgTable(
  "communication",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    activityId: t
      .uuid()
      .notNull()
      .references(() => activity.id, { onDelete: "cascade" }),
    provider: t.varchar({ length: 64 }).notNull(),
    externalId: t.varchar({ length: 256 }),
    threadId: t.varchar({ length: 256 }),
    subject: t.text(),
    body: t.text(),
    attachments: t
      .jsonb()
      .$type<
        {
          name: string;
          url: string;
          contentType?: string;
          size?: number;
        }[]
      >()
      .notNull()
      .default([]),
    status: t.varchar({ length: 32 }).notNull().default("pending"),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => [
    uniqueIndex("communication_provider_ext_uniq").on(
      table.provider,
      table.externalId,
    ),
    index("communication_thread_idx").on(table.threadId),
  ],
);

export const task = pgTable(
  "task",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    organizationId: t
      .uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: t
      .uuid()
      .references(() => project.id, { onDelete: "set null" }),
    contactId: t
      .uuid()
      .references(() => contact.id, { onDelete: "set null" }),
    ownerUserId: t
      .text()
      .references(() => user.id, { onDelete: "set null" }),
    createdByAgentId: t
      .uuid()
      .references(() => agent.id, { onDelete: "set null" }),
    title: t.varchar({ length: 256 }).notNull(),
    description: t.text(),
    dueAt: t.timestamp({ withTimezone: true }),
    status: t
      .varchar({
        length: 32,
        enum: ["open", "in_progress", "blocked", "done", "cancelled"],
      })
      .notNull()
      .default("open"),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  }),
  (table) => [
    index("task_owner_status_idx").on(table.ownerUserId, table.status),
    index("task_due_idx").on(table.dueAt),
  ],
);

export const CreateTaskSchema = createInsertSchema(task, {
  title: z.string().min(1).max(256),
  description: z.string().max(4000).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const document = pgTable(
  "document",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    organizationId: t
      .uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: t
      .uuid()
      .references(() => project.id, { onDelete: "set null" }),
    contactId: t
      .uuid()
      .references(() => contact.id, { onDelete: "set null" }),
    kind: t.varchar({ length: 64 }).notNull(),
    title: t.varchar({ length: 256 }),
    storageUrl: t.text().notNull(),
    mimeType: t.varchar({ length: 128 }),
    sizeBytes: t.integer(),
    transactionRef: t.varchar({ length: 128 }),
    metadata: t
      .jsonb()
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => [
    index("document_project_kind_idx").on(table.projectId, table.kind),
    index("document_transaction_idx").on(table.transactionRef),
  ],
);
