import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod/v4";

import { resolveOrgId } from "@acme/auth/org-resolver";
import { db } from "@acme/db/client";
import { chatThread } from "@acme/db/schema";

import type { CoreHonoEnv } from "../middleware/context";
import { getRequiredActor, requireActor } from "../middleware/context";

const THREAD_LIST_LIMIT_DEFAULT = 20;
const THREAD_LIST_LIMIT_MAX = 100;

const UpsertThreadBodySchema = z.object({
  title: z.string().min(1).max(120).optional(),
});

/**
 * CRUD for the `chat_thread` directory. Scoped to the authenticated user's
 * org. Messages themselves live in Redis (see @acme/kv) — this router only
 * manages the "which threads do I have?" side.
 *
 * All routes require a user session; agents don't manage user threads.
 */
export const chatThreadsRest = new Hono<CoreHonoEnv>()
  .use(requireActor)
  /**
   * List threads for the current user, newest first.
   */
  .get("/", async (c) => {
    const actor = getRequiredActor(c);
    if (actor.type !== "user") {
      return c.json({ error: "user session required" }, 403);
    }

    const organizationId = await resolveOrgId(actor);
    if (!organizationId) {
      return c.json({ error: "organization missing for actor" }, 400);
    }

    const limitRaw = Number(c.req.query("limit") ?? THREAD_LIST_LIMIT_DEFAULT);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(1, Math.floor(limitRaw)), THREAD_LIST_LIMIT_MAX)
      : THREAD_LIST_LIMIT_DEFAULT;

    const rows = await db
      .select({
        id: chatThread.id,
        title: chatThread.title,
        lastMessageAt: chatThread.lastMessageAt,
        createdAt: chatThread.createdAt,
      })
      .from(chatThread)
      .where(
        and(
          eq(chatThread.organizationId, organizationId),
          eq(chatThread.userId, actor.userId),
        ),
      )
      .orderBy(desc(chatThread.lastMessageAt))
      .limit(limit);

    return c.json({ threads: rows });
  })
  /**
   * Upsert a thread row. Client or harness calls this on the first message
   * of a thread (to set the title) and on every subsequent message (to bump
   * `last_message_at` for sorting).
   *
   * `title` only wins on insert; updates never change an existing title so
   * the harness can safely retry without overwriting a user-edited title.
   */
  .put("/:threadId", async (c) => {
    const actor = getRequiredActor(c);
    if (actor.type !== "user") {
      return c.json({ error: "user session required" }, 403);
    }

    const organizationId = await resolveOrgId(actor);
    if (!organizationId) {
      return c.json({ error: "organization missing for actor" }, 400);
    }

    const threadId = c.req.param("threadId");
    if (!threadId || threadId.length > 128) {
      return c.json({ error: "invalid threadId" }, 400);
    }

    const body = UpsertThreadBodySchema.safeParse(
      await c.req.json().catch(() => ({})),
    );
    if (!body.success) {
      return c.json({ error: "validation", issues: body.error.issues }, 400);
    }

    const insertValues = {
      id: threadId,
      organizationId,
      userId: actor.userId,
      title: body.data.title ?? "New thread",
    };

    const [row] = await db
      .insert(chatThread)
      .values(insertValues)
      .onConflictDoUpdate({
        target: chatThread.id,
        set: {
          lastMessageAt: sql`now()`,
        },
      })
      .returning({
        id: chatThread.id,
        title: chatThread.title,
        lastMessageAt: chatThread.lastMessageAt,
      });

    return c.json(row);
  });
