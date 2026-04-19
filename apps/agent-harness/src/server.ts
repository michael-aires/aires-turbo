import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod/v4";

import { createChatSessions } from "@acme/kv/chat-sessions";
import { createLogger, startTelemetry } from "@acme/observability";

import { env } from "./env";
import { resolveCaller } from "./lib/resolve-caller";
import { executeRun } from "./runs/execute-run";

startTelemetry("aires-agent-harness");
const logger = createLogger("aires-agent-harness");

const app = new Hono();

app.use("*", cors({ origin: "*", credentials: false }));

app.get("/healthz", (c) => c.json({ ok: true }));
app.get("/readyz", (c) => c.json({ ok: true }));

const RunRequestSchema = z.object({
  agentId: z.string().min(1),
  threadId: z.string().min(1),
  message: z.string().min(1).max(8000),
  providerOverride: z.enum(["claude", "gpt", "gemini"]).optional(),
});

app.post("/v1/runs", async (c) => {
  const body = RunRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) {
    return c.json({ error: "invalid_request", issues: body.error.flatten() }, 400);
  }

  const sessionCookie = c.req.header("cookie") ?? undefined;
  const apiKey = c.req.header("x-api-key") ?? undefined;
  if (!sessionCookie && !apiKey) {
    return c.json({ error: "unauthenticated" }, 401);
  }

  const runId = crypto.randomUUID();
  try {
    const { provider, stream } = await executeRun({
      runId,
      agentId: body.data.agentId,
      organizationId: env.SINGLE_ORG_ID,
      threadId: body.data.threadId,
      message: body.data.message,
      sessionCookie,
      apiKey,
      providerOverride: body.data.providerOverride ?? null,
    });

    c.header("x-run-id", runId);
    c.header("x-agent-provider", provider);
    return stream.toUIMessageStreamResponse();
  } catch (err) {
    logger.error(
      { runId, err: err instanceof Error ? err.message : String(err) },
      "agent-harness.run.failed",
    );
    return c.json(
      { error: "run_failed", runId, message: err instanceof Error ? err.message : "error" },
      500,
    );
  }
});

/**
 * Read the persisted ring-buffer for a thread. Scoped to the authenticated
 * user's org. Returns the messages in chronological order. The caller must
 * be authenticated (session cookie or API key) and belong to
 * `SINGLE_ORG_ID`; otherwise we return 401/403.
 *
 * Empty threads return `{ messages: [] }` rather than 404 — makes hydration
 * on the client simpler (no "not found" special case for brand-new threads).
 */
app.get("/v1/threads/:threadId/messages", async (c) => {
  const threadId = c.req.param("threadId");
  if (!threadId) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const sessionCookie = c.req.header("cookie") ?? undefined;
  const apiKey = c.req.header("x-api-key") ?? undefined;
  if (!sessionCookie && !apiKey) {
    return c.json({ error: "unauthenticated" }, 401);
  }

  try {
    const caller = await resolveCaller({
      sessionCookie,
      apiKey,
      organizationId: env.SINGLE_ORG_ID,
    });
    if (!caller) {
      return c.json({ error: "unauthenticated" }, 401);
    }
    if (caller.orgId && caller.orgId !== env.SINGLE_ORG_ID) {
      return c.json({ error: "forbidden" }, 403);
    }

    const sessions = createChatSessions({
      maxMessages: env.CHAT_THREAD_MAX_MESSAGES,
    });
    const messages = await sessions.read(threadId);
    return c.json({ threadId, messages });
  } catch (err) {
    logger.error(
      {
        threadId,
        err: err instanceof Error ? err.message : String(err),
      },
      "agent-harness.threads.read.failed",
    );
    return c.json({ error: "internal_error" }, 500);
  }
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, "agent-harness.listen");
});

export default app;
