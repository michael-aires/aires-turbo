import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { createLogger, startTelemetry } from "@acme/observability";

import { env } from "./env.js";
import { handleInboundWhatsApp } from "./handlers/whatsapp.js";

startTelemetry("aires-chat-bots");
const logger = createLogger("aires-chat-bots");

const app = new Hono();

app.get("/healthz", (c) => c.json({ ok: true }));
app.get("/readyz", (c) => c.json({ ok: true }));

/**
 * Internal endpoint called by the core webhook dispatcher once a Twilio
 * signature has been verified. The shared secret header is the only thing
 * guarding this endpoint from the public internet — chat-bots MUST NOT be
 * exposed publicly (deploy behind Railway private networking).
 */
app.post("/internal/whatsapp/inbound", async (c) => {
  const provided = c.req.header("x-aires-bot-secret");
  if (!provided || provided !== env.BOT_INTERNAL_SECRET) {
    return c.json({ error: "unauthorized" }, 401);
  }

  try {
    const payload = (await c.req.json()) as unknown;
    const result = await handleInboundWhatsApp(payload);
    return c.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, "chat-bots.whatsapp.failed");
    return c.json({ error: "processing_failed", message }, 500);
  }
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, "chat-bots.listen");
});

export default app;
