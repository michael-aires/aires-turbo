import { sql } from "drizzle-orm";
import { index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "../auth-schema";
import { organization } from "./identity";

/**
 * Lightweight index of chat threads so the UI can show a "recent threads"
 * list. Messages themselves still live in Redis (see @acme/kv
 * `createChatSessions`) — this table is the *directory*, not the archive.
 *
 * The Vercel chatbot fork will extend persistence to full message storage;
 * for now we keep the directory so users can resume where they left off.
 */
export const chatThread = pgTable(
  "chat_thread",
  (t) => ({
    /**
     * Thread ID is assigned by the client (UUID generated on "new thread")
     * so we can route to `/chat/[threadId]` before the row exists. The
     * harness upserts this row on the first message of the thread.
     */
    id: t.text().primaryKey(),
    organizationId: t
      .uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: t
      .text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: t.varchar({ length: 120 }).notNull().default("New thread"),
    lastMessageAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => sql`now()`),
  }),
  (table) => [
    index("chat_thread_user_last_msg_idx").on(
      table.userId,
      table.lastMessageAt,
    ),
    index("chat_thread_org_idx").on(table.organizationId),
    uniqueIndex("chat_thread_org_user_id_uniq").on(
      table.organizationId,
      table.userId,
      table.id,
    ),
  ],
);
