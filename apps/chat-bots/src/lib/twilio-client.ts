import { env } from "../env.js";

export interface SendWhatsAppInput {
  to: string;
  body: string;
}

/**
 * Minimal Twilio REST client — avoids pulling the full SDK for one endpoint.
 * Uses Basic Auth with the Account SID + Auth Token, which is exactly how
 * Twilio authenticates server-side API calls.
 */
export async function sendWhatsAppMessage(
  input: SendWhatsAppInput,
  deps: { fetch?: typeof fetch } = {},
): Promise<{ sid: string }> {
  const fetchImpl = deps.fetch ?? fetch;
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) {
    throw new Error("twilio not configured; cannot send whatsapp message");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const body = new URLSearchParams({
    From: from,
    To: input.to,
    Body: input.body.slice(0, 1600),
  });

  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`twilio send failed: ${res.status} ${detail}`);
  }

  const payload = (await res.json()) as { sid?: string };
  return { sid: payload.sid ?? "" };
}
