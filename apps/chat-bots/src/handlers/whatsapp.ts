import { z } from "zod/v4";

import { createLogger } from "@acme/observability";

import { env } from "../env.js";
import { sendWhatsAppMessage } from "../lib/twilio-client.js";

const logger = createLogger("chat-bots.whatsapp");

export const InboundWhatsAppSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  body: z.string().min(1).max(4000),
  messageSid: z.string().min(1),
  orgId: z.string().min(1),
});

export type InboundWhatsApp = z.infer<typeof InboundWhatsAppSchema>;

export interface HandleWhatsAppDeps {
  fetch?: typeof fetch;
  sendWhatsApp?: typeof sendWhatsAppMessage;
}

/**
 * Handle a Twilio-verified inbound WhatsApp message:
 *   1. Mint an agent run against the harness using the bot API key
 *   2. Collect the streamed assistant response
 *   3. Send it back via Twilio REST
 *
 * Signature verification MUST happen upstream (in apps/core webhook) — this
 * handler trusts its input and is never exposed to the public internet.
 */
export async function handleInboundWhatsApp(
  raw: unknown,
  deps: HandleWhatsAppDeps = {},
): Promise<{ assistantText: string; twilioSid: string }> {
  const message = InboundWhatsAppSchema.parse(raw);
  const fetchImpl = deps.fetch ?? fetch;
  const send = deps.sendWhatsApp ?? sendWhatsAppMessage;

  const threadId = `wa:${message.from}`;

  logger.info(
    { from: message.from, messageSid: message.messageSid, threadId },
    "chat-bots.whatsapp.inbound",
  );

  const res = await fetchImpl(`${env.HARNESS_INTERNAL_URL}/v1/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.BOT_API_KEY,
      "x-organization-id": env.SINGLE_ORG_ID,
      "x-aires-bot-id": env.BOT_AGENT_ID,
    },
    body: JSON.stringify({
      agentId: env.BOT_AGENT_ID,
      threadId,
      message: message.body,
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`harness refused run: ${res.status} ${detail}`);
  }

  const assistantText = await drainTextStream(res.body);
  const trimmed = assistantText.trim() || "(the agent returned an empty reply)";

  const result = await send({ to: message.from, body: trimmed });
  return { assistantText: trimmed, twilioSid: result.sid };
}

/**
 * Drain an AI-SDK v5 UI message stream (SSE) and concatenate all
 * `text-delta` chunks into one string. The stream is line-delimited
 * `data: {...}` events; `[DONE]` marks the end. Non-text parts (tool
 * calls, reasoning, errors) are ignored — those are surfaced on the
 * core audit trail, not the WhatsApp reply.
 *
 * We explicitly buffer across chunk boundaries so a JSON event that
 * straddles two read()s isn't dropped.
 */
export async function drainTextStream(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice("data:".length).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as { type?: string; delta?: string };
        if (parsed.type === "text-delta" && typeof parsed.delta === "string") {
          text += parsed.delta;
        }
      } catch {
        // Non-JSON frame; ignore.
      }
    }
  }

  // Flush any trailing buffer.
  const trailing = buffer.trim();
  if (trailing.startsWith("data:")) {
    const payload = trailing.slice("data:".length).trim();
    if (payload && payload !== "[DONE]") {
      try {
        const parsed = JSON.parse(payload) as { type?: string; delta?: string };
        if (parsed.type === "text-delta" && typeof parsed.delta === "string") {
          text += parsed.delta;
        }
      } catch {
        // ignore trailing malformed frame
      }
    }
  }

  return text;
}
