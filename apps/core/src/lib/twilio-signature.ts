import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio webhook signature verification (HMAC-SHA1 over URL + sorted form
 * params). Kept in core so the public webhook can verify before ANY other
 * work — enqueue or DB write. Matches the algorithm in apps/chat-bots and
 * documented at https://www.twilio.com/docs/usage/webhooks/webhooks-security.
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
