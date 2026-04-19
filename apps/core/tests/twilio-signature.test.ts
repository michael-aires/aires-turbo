import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import { verifyTwilioSignature } from "../src/lib/twilio-signature.js";

function sign(authToken: string, fullUrl: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const concat = sortedKeys.reduce((acc, key) => acc + key + params[key], fullUrl);
  return createHmac("sha1", authToken).update(concat, "utf-8").digest("base64");
}

describe("apps/core verifyTwilioSignature", () => {
  const authToken = "aires-core-test-auth-token-xyz";
  const fullUrl = "https://core.aires.ai/webhooks/whatsapp";
  const params = {
    From: "whatsapp:+15551234567",
    Body: "hi there",
    MessageSid: "SM_core_1",
  };

  it("accepts a correctly signed request", () => {
    const sig = sign(authToken, fullUrl, params);
    assert.equal(
      verifyTwilioSignature({ authToken, signature: sig, fullUrl, params }),
      true,
    );
  });

  it("rejects tampered body", () => {
    const sig = sign(authToken, fullUrl, params);
    assert.equal(
      verifyTwilioSignature({
        authToken,
        signature: sig,
        fullUrl,
        params: { ...params, Body: "different" },
      }),
      false,
    );
  });

  it("rejects missing signature", () => {
    assert.equal(
      verifyTwilioSignature({ authToken, signature: "", fullUrl, params }),
      false,
    );
  });
});
