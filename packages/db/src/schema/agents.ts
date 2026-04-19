import { index, pgTable } from "drizzle-orm/pg-core";

import { agent, organization, project } from "./identity.js";

export const tool = pgTable(
  "tool",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    name: t.varchar({ length: 128 }).notNull().unique(),
    displayName: t.varchar({ length: 256 }).notNull(),
    description: t.text().notNull(),
    category: t.varchar({ length: 64 }).notNull().default("general"),
    inputSchema: t.jsonb().$type<Record<string, unknown>>().notNull(),
    outputSchema: t
      .jsonb()
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    requiredScopes: t.jsonb().$type<string[]>().notNull().default([]),
    requiresApproval: t.boolean().notNull().default(false),
    costTier: t.varchar({ length: 32 }).notNull().default("free"),
    enabled: t.boolean().notNull().default(true),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => [index("tool_category_idx").on(table.category)],
);

export const agentRun = pgTable(
  "agent_run",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    agentId: t
      .uuid()
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    toolName: t.varchar({ length: 128 }).notNull(),
    status: t
      .varchar({
        length: 16,
        enum: ["pending", "running", "waiting_approval", "succeeded", "failed", "cancelled"],
      })
      .notNull()
      .default("pending"),
    projectId: t.uuid().references(() => project.id, { onDelete: "set null" }),
    input: t.jsonb().$type<Record<string, unknown>>().notNull(),
    output: t.jsonb().$type<Record<string, unknown>>(),
    errorMessage: t.text(),
    costCents: t.integer().notNull().default(0),
    startedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    endedAt: t.timestamp({ withTimezone: true }),
  }),
  (table) => [
    index("agent_run_agent_idx").on(table.agentId),
    index("agent_run_status_idx").on(table.status),
  ],
);

export const approval = pgTable(
  "approval",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    agentRunId: t
      .uuid()
      .notNull()
      .references(() => agentRun.id, { onDelete: "cascade" }),
    organizationId: t
      .uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    requestedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    decidedAt: t.timestamp({ withTimezone: true }),
    decidedBy: t.text(),
    decision: t.varchar({
      length: 16,
      enum: ["pending", "approved", "rejected"],
    }).notNull().default("pending"),
    reason: t.text(),
  }),
  (table) => [
    index("approval_run_idx").on(table.agentRunId),
    index("approval_org_pending_idx").on(
      table.organizationId,
      table.decision,
    ),
  ],
);
