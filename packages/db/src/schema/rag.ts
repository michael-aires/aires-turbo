import { sql } from "drizzle-orm";
import {
  customType,
  index,
  pgTable,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { agent, organization, project } from "./identity";

// pgvector custom type. Stored as native `vector(N)`; read as number[].
// https://github.com/pgvector/pgvector
const vector = (dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value) {
      return `[${value.join(",")}]`;
    },
    fromDriver(value) {
      if (typeof value !== "string") return [];
      return value
        .slice(1, -1)
        .split(",")
        .map((n) => Number(n));
    },
  });

export const kbDocument = pgTable(
  "kb_document",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    organizationId: t
      .uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: t
      .uuid()
      .references(() => project.id, { onDelete: "set null" }),
    sourceUrl: t.text(),
    title: t.varchar({ length: 512 }).notNull(),
    checksum: t.varchar({ length: 64 }).notNull(),
    metadata: t
      .jsonb()
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => [
    uniqueIndex("kb_doc_org_checksum_uniq").on(
      table.organizationId,
      table.checksum,
    ),
    index("kb_doc_project_idx").on(table.projectId),
  ],
);

const embedding1536 = vector(1536);

export const kbChunk = pgTable(
  "kb_chunk",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    documentId: t
      .uuid()
      .notNull()
      .references(() => kbDocument.id, { onDelete: "cascade" }),
    chunkIndex: t.integer().notNull(),
    content: t.text().notNull(),
    contentTsv: t.text(),
    embedding: embedding1536("embedding").notNull(),
    tokens: t.integer(),
    metadata: t
      .jsonb()
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  }),
  (table) => [
    uniqueIndex("kb_chunk_doc_idx_uniq").on(
      table.documentId,
      table.chunkIndex,
    ),
  ],
);

export const agentMemory = pgTable(
  "agent_memory",
  (t) => ({
    id: t.uuid().primaryKey().defaultRandom(),
    agentId: t
      .uuid()
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    projectId: t.uuid().references(() => project.id, { onDelete: "set null" }),
    namespace: t.varchar({ length: 128 }).notNull().default("default"),
    content: t.text().notNull(),
    embedding: embedding1536("embedding").notNull(),
    metadata: t
      .jsonb()
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  }),
  (table) => [
    index("agent_memory_agent_ns_idx").on(table.agentId, table.namespace),
  ],
);

// NOTE: pgvector HNSW indexes must be created with custom SQL — Drizzle does
// not yet have first-class HNSW support. Add via migration:
//   CREATE INDEX kb_chunk_embedding_hnsw
//     ON kb_chunk USING hnsw (embedding vector_cosine_ops);
//   CREATE INDEX agent_memory_embedding_hnsw
//     ON agent_memory USING hnsw (embedding vector_cosine_ops);
//   CREATE INDEX kb_chunk_tsv_idx ON kb_chunk USING gin (to_tsvector('english', content));
export const vectorMigrationSql = sql`-- see comment in rag.ts`;
