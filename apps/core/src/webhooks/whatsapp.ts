import { Hono } from "hono";

import { createLogger } from "@acme/observability";

import { env } from "../env.js";
import { verifyTwilioSignature } from "../lib/twilio-signature.js";

const logger = createLogger("aires-core.whatsapp-webhook");

export const whatsappWebhookRouter = new Hono();

/**
 * Public Twilio WhatsApp webhook. Verifies the HMAC signature first — any
 * request that fails verification is rejected before any downstream work
 * happens. Verified inbound messages are forwarded to chat-bots via Railway
 * private networking, authenticated with a shared internal secret.
 *
 * Responds to Twilio within 200ms by firing the forward asynchronously.
 * Twilio retries on non-2xx, so we acknowledge early and log async failures.
 */
whatsappWebhookRouter.post("/webhooks/whatsapp", async (c) => {
  const authToken = env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    logger.error({}, "whatsapp.webhook.unconfigured");
    return c.json({ error: "twilio_not_configured" }, 503);
  }

  const signature = c.req.header("x-twilio-signature") ?? "";
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return c.json({ error: "unsupported_content_type" }, 415);
  }

  const raw = await c.req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw).entries()) {
    params[k] = v;
  }

  const fullUrl = `${env.CORE_PUBLIC_URL.replace(/\/$/, "")}${c.req.path}`;

  const ok = verifyTwilioSignature({
    authToken,
    signature,
    fullUrl,
    params,
  });
  if (!ok) {
    logger.warn(
      { signaturePrefix: signature.slice(0, 6), fullUrl },
      "whatsapp.webhook.invalid_signature",
    );
    return c.json({ error: "invalid_signature" }, 403);
  }

  const from = params.From ?? "";
  const to = params.To ?? "";
  const body = params.Body ?? "";
  const messageSid = params.MessageSid ?? "";

  if (!from || !body || !messageSid) {
    return c.json({ error: "missing_fields" }, 400);
  }

  const botsUrl = env.CHAT_BOTS_INTERNAL_URL;
  const botSecret = env.BOT_INTERNAL_SECRET;
  const orgId = env.SINGLE_ORG_ID;
  if (!botsUrl || !botSecret || !orgId) {
    logger.error({}, "whatsapp.webhook.bots_not_configured");
    return c.json({ error: "bots_not_configured" }, 503);
  }

  void forwardToBots({
    botsUrl,
    botSecret,
    payload: { from, to, body, messageSid, orgId },
  }).catch((err: unknown) => {
    logger.error(
      { messageSid, err: err instanceof Error ? err.message : String(err) },
      "whatsapp.webhook.forward_failed",
    );
  });

  return c.body(null, 204);
});

async function forwardToBots(input: {
  botsUrl: string;
  botSecret: string;
  payload: {
    from: string;
    to: string;
    body: string;
    messageSid: string;
    orgId: string;
  };
}): Promise<void> {
  const res = await fetch(`${input.botsUrl.replace(/\/$/, "")}/internal/whatsapp/inbound`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-aires-bot-secret": input.botSecret,
    },
    body: JSON.stringify(input.payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`bots responded ${res.status}: ${detail}`);
  }
}
