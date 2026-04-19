import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import { verifyTwilioSignature } from "../src/lib/twilio-signature.js";

function sign(authToken: string, fullUrl: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const concat = sortedKeys.reduce((acc, key) => acc + key + params[key], fullUrl);
  return createHmac("sha1", authToken).update(concat, "utf-8").digest("base64");
}

describe("verifyTwilioSignature", () => {
  const authToken = "super-secret-auth-token-1234567890";
  const fullUrl = "https://aires.ai/webhooks/whatsapp";
  const params = {
    From: "whatsapp:+15551234567",
    Body: "Hi agent",
    MessageSid: "SM1234",
  };

  it("accepts a correctly signed request", () => {
    const sig = sign(authToken, fullUrl, params);
    assert.equal(
      verifyTwilioSignature({ authToken, signature: sig, fullUrl, params }),
      true,
    );
  });

  it("rejects when the body is tampered with", () => {
    const sig = sign(authToken, fullUrl, params);
    assert.equal(
      verifyTwilioSignature({
        authToken,
        signature: sig,
        fullUrl,
        params: { ...params, Body: "Hi evil" },
      }),
      false,
    );
  });

  it("rejects when the URL is tampered with", () => {
    const sig = sign(authToken, fullUrl, params);
    assert.equal(
      verifyTwilioSignature({
        authToken,
        signature: sig,
        fullUrl: "https://evil.ai/webhooks/whatsapp",
        params,
      }),
      false,
    );
  });

  it("rejects when the auth token is wrong", () => {
    const sig = sign(authToken, fullUrl, params);
    assert.equal(
      verifyTwilioSignature({
        authToken: "different-token",
        signature: sig,
        fullUrl,
        params,
      }),
      false,
    );
  });

  it("rejects empty signature", () => {
    assert.equal(
      verifyTwilioSignature({ authToken, signature: "", fullUrl, params }),
      false,
    );
  });
});
