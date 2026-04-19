import { sql } from "drizzle-orm";
import { index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "../auth-schema";

export const organization = pgTable("organization", (t) => ({
  id: t.uuid().primaryKey().defaultRandom(),
  name: t.varchar({ length: 256 }).notNull(),
  slug: t.varchar({ length: 128 }).notNull().unique(),
  // organization() plugin
  logo: t.text(),
  metadata: t.text(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp({ withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => sql`now()`),
}));

export const member = pgTable(
  "member",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    organizationId: t
      .uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: t
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: t.varchar({ length: 32 }).notNull().default("member"),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => [
    uniqueIndex("member_org_user_uniq").on(table.organizationId, table.userId),
  ],
);

export const project = pgTable(
  "project",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    organizationId: t
      .uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: t.varchar({ length: 256 }).notNull(),
    slug: t.varchar({ length: 128 }).notNull(),
    pxpProjectId: t.text(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => [
    uniqueIndex("project_org_slug_uniq").on(table.organizationId, table.slug),
    index("project_pxp_id_idx").on(table.pxpProjectId),
  ],
);

export const apiKey = pgTable(
  "api_key",
  (t) => ({
    id: t.text().primaryKey(),
    name: t.text(),
    start: t.text(),
    prefix: t.text(),
    key: t.text().notNull(),
    userId: t
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    refillInterval: t.integer(),
    refillAmount: t.integer(),
    lastRefillAt: t.timestamp({ withTimezone: true }),
    enabled: t.boolean().notNull().default(true),
    rateLimitEnabled: t.boolean().notNull().default(true),
    rateLimitTimeWindow: t.integer(),
    rateLimitMax: t.integer(),
    requestCount: t.integer().notNull().default(0),
    remaining: t.integer(),
    lastRequest: t.timestamp({ withTimezone: true }),
    expiresAt: t.timestamp({ withTimezone: true }),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => sql`now()`),
    permissions: t.text(),
    metadata: t.text(),
  }),
  (table) => [index("api_key_user_idx").on(table.userId)],
);

export const jwks = pgTable("jwks", (t) => ({
  id: t.text().primaryKey(),
  publicKey: t.text().notNull(),
  privateKey: t.text().notNull(),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
}));

export const agent = pgTable(
  "agent",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    organizationId: t
      .uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    ownerUserId: t
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    name: t.varchar({ length: 128 }).notNull(),
    description: t.text(),
    status: t
      .varchar({ length: 32, enum: ["active", "paused", "revoked"] })
      .notNull()
      .default("active"),
    scopes: t.jsonb().$type<string[]>().notNull().default([]),
    projectIds: t.jsonb().$type<string[]>().notNull().default([]),
    rateLimitTier: t.varchar({ length: 32 }).notNull().default("default"),
    spendCapCents: t.integer().notNull().default(0),
    memoryNamespace: t.varchar({ length: 128 }),
    model: t.varchar({ length: 64 }),
    apiKeyId: t
      .text()
      .references(() => apiKey.id, { onDelete: "set null" }),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => [
    index("agent_org_idx").on(table.organizationId),
    index("agent_owner_idx").on(table.ownerUserId),
  ],
);

export const agentToken = pgTable(
  "agent_token",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    agentId: t
      .uuid()
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    jti: t.varchar({ length: 64 }).notNull().unique(),
    scopes: t.jsonb().$type<string[]>().notNull().default([]),
    projectIds: t.jsonb().$type<string[]>().notNull().default([]),
    issuedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    expiresAt: t.timestamp({ withTimezone: true }).notNull(),
    revokedAt: t.timestamp({ withTimezone: true }),
    lastUsedAt: t.timestamp({ withTimezone: true }),
  }),
  (table) => [index("agent_token_agent_idx").on(table.agentId)],
);

export const auditLog = pgTable(
  "audit_log",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    actorType: t
      .varchar({ length: 16, enum: ["user", "agent", "system"] })
      .notNull(),
    actorId: t.text().notNull(),
    organizationId: t.uuid().references(() => organization.id, {
      onDelete: "set null",
    }),
    projectId: t
      .uuid()
      .references(() => project.id, { onDelete: "set null" }),
    tool: t.varchar({ length: 128 }),
    action: t.varchar({ length: 64 }).notNull(),
    argsHash: t.varchar({ length: 64 }),
    result: t.varchar({ length: 16, enum: ["ok", "error", "denied"] }),
    errorCode: t.varchar({ length: 64 }),
    durationMs: t.integer(),
    approvalId: t.uuid(),
    runId: t.uuid(),
    metadata: t.jsonb().$type<Record<string, unknown>>(),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => [
    index("audit_actor_idx").on(table.actorType, table.actorId),
    index("audit_org_created_idx").on(table.organizationId, table.createdAt),
    index("audit_tool_idx").on(table.tool),
  ],
);
