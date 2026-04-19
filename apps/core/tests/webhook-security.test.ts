/**
 * SSRF guard for webhook subscription URLs. These tests are pure URL parsing
 * + private-IP classification; no DNS calls are exercised for the blocked
 * cases because the hostname blocklist short-circuits before `lookup`.
 */

import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";

import { TRPCError } from "@trpc/server";

import { validateWebhookTarget } from "@acme/api/webhook-security";

const originalNodeEnv = process.env.NODE_ENV;

before(() => {
  process.env.NODE_ENV = "production";
});

after(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

async function assertRejected(input: string, messageFragment?: string) {
  await assert.rejects(
    () => validateWebhookTarget(input),
    (err) => {
      if (!(err instanceof TRPCError)) return false;
      if (err.code !== "BAD_REQUEST") return false;
      if (messageFragment && !err.message.includes(messageFragment)) return false;
      return true;
    },
  );
}

describe("validateWebhookTarget - protocol + shape", () => {
  it("rejects non-URL strings", async () => {
    await assertRejected("not a url", "invalid webhook url");
  });

  it("rejects http:// in production", async () => {
    await assertRejected("http://example.com/hook", "must use https");
  });

  it("rejects urls with embedded credentials", async () => {
    await assertRejected(
      "https://user:pass@example.com/hook",
      "must not embed credentials",
    );
  });
});

describe("validateWebhookTarget - hostname blocklist", () => {
  it("rejects localhost", async () => {
    await assertRejected("https://localhost/hook", "not allowed");
  });

  it("rejects .internal hostnames", async () => {
    await assertRejected("https://api.internal/hook", "not allowed");
  });

  it("rejects .local hostnames", async () => {
    await assertRejected("https://printer.local/hook", "not allowed");
  });
});

describe("validateWebhookTarget - private IP literals", () => {
  it("rejects RFC1918 10/8", async () => {
    await assertRejected(
      "https://10.0.0.1/hook",
      "must not resolve to a private address",
    );
  });

  it("rejects RFC1918 172.16/12", async () => {
    await assertRejected("https://172.16.0.1/hook", "private address");
  });

  it("rejects RFC1918 192.168/16", async () => {
    await assertRejected("https://192.168.1.10/hook", "private address");
  });

  it("rejects loopback 127.0.0.0/8", async () => {
    await assertRejected("https://127.0.0.1/hook", "private address");
  });

  it("rejects link-local 169.254/16", async () => {
    await assertRejected("https://169.254.169.254/hook", "private address");
  });

  it("rejects 0.0.0.0", async () => {
    await assertRejected("https://0.0.0.0/hook", "private address");
  });

  it("rejects IPv6 loopback ::1", async () => {
    await assertRejected("https://[::1]/hook", "private address");
  });

  it("rejects IPv6 unique-local fc00::/7", async () => {
    await assertRejected("https://[fc00::1]/hook", "private address");
    await assertRejected("https://[fd12:3456::1]/hook", "private address");
  });
});

describe("validateWebhookTarget - accepted urls", () => {
  it("strips fragments from the returned url", async () => {
    const result = await validateWebhookTarget("https://8.8.8.8/hook#fragment");
    assert.equal(result, "https://8.8.8.8/hook");
  });

  it("returns an https url unchanged when host is a public IP", async () => {
    const result = await validateWebhookTarget("https://1.1.1.1/hook");
    assert.equal(result, "https://1.1.1.1/hook");
  });
});
