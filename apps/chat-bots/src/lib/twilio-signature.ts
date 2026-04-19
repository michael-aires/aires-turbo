import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio webhook signature verification using HMAC-SHA1 over the full URL
 * concatenated with sorted form params. Matches the algorithm documented at
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security and is the
 * only security boundary for inbound WhatsApp messages.
 *
 * Extracted for testability — the webhook in apps/core uses the same logic.
 */
export function verifyTwilioSignature(input: {
  authToken: string;
  signature: string;
  fullUrl: string;
  params: Record<string, string>;
}): boolean {
  if (!input.authToken || !input.signature || !input.fullUrl) return false;

  const sortedKeys = Object.keys(input.params).sort();
  const concatenated = sortedKeys.reduce((acc, key) => {
    return acc + key + input.params[key];
  }, input.fullUrl);

  const expected = createHmac("sha1", input.authToken)
    .update(concatenated, "utf-8")
    .digest("base64");

  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(input.signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return timingSafeEqual(expectedBuf, signatureBuf);
}
