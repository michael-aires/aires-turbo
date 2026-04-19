import { strict as assert } from "node:assert";
import { before, describe, it } from "node:test";

process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.CORE_INTERNAL_URL ??= "http://core.local";
process.env.MCP_SERVER_URL ??= "http://mcp.local";
process.env.SINGLE_ORG_ID ??= "00000000-0000-0000-0000-000000000000";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-xx";

type ResolveCallerModule = typeof import("../src/lib/resolve-caller.js");
let resolveCaller: ResolveCallerModule["resolveCaller"];

before(async () => {
  ({ resolveCaller } = await import("../src/lib/resolve-caller.js"));
});

function fakeFetch(response: { status: number; body?: unknown }): {
  fetch: typeof fetch;
  calls: { url: string; init?: RequestInit }[];
} {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    return new Response(
      response.body !== undefined ? JSON.stringify(response.body) : "",
      { status: response.status, headers: { "content-type": "application/json" } },
    );
  };
  return { fetch: fetchImpl, calls };
}

describe("resolveCaller", () => {
  it("returns null when the caller has no cookie or API key", async () => {
    const { fetch: fetchImpl } = fakeFetch({ status: 200, body: {} });
    const result = await resolveCaller(
      { organizationId: "org_1" },
      { fetch: fetchImpl },
    );
    assert.equal(result, null);
  });

  it("returns null on 401/403 from core", async () => {
    for (const status of [401, 403]) {
      const { fetch: fetchImpl } = fakeFetch({ status });
      const result = await resolveCaller(
        { organizationId: "org_1", sessionCookie: "s=abc" },
        { fetch: fetchImpl },
      );
      assert.equal(result, null, `status ${status.toString()}`);
    }
  });

  it("resolves a user session into a user actor", async () => {
    const { fetch: fetchImpl, calls } = fakeFetch({
      status: 200,
      body: {
        actor: {
          type: "user",
          userId: "user_1",
          sessionId: "sess_1",
          orgId: "org_1",
        },
        requestId: "req_1",
      },
    });
    const result = await resolveCaller(
      { organizationId: "org_1", sessionCookie: "s=abc" },
      { fetch: fetchImpl },
    );
    assert.deepEqual(result, {
      type: "user",
      userId: "user_1",
      orgId: "org_1",
    });
    assert.equal(calls.length, 1);
    const headers = calls[0]?.init?.headers as Record<string, string>;
    assert.equal(headers.cookie, "s=abc");
    assert.equal(headers["x-organization-id"], "org_1");
  });

  it("resolves an agent actor", async () => {
    const { fetch: fetchImpl } = fakeFetch({
      status: 200,
      body: {
        actor: {
          type: "agent",
          agentId: "agent_1",
          tokenId: "tok_1",
          scopes: ["contacts.read"],
          projectIds: [],
        },
        requestId: "req_1",
      },
    });
    const result = await resolveCaller(
      { organizationId: "org_1", apiKey: "key_123" },
      { fetch: fetchImpl },
    );
    assert.deepEqual(result, {
      type: "agent",
      agentId: "agent_1",
      scopes: ["contacts.read"],
      orgId: undefined,
    });
  });

  it("throws on non-401/403 errors", async () => {
    const { fetch: fetchImpl } = fakeFetch({ status: 500 });
    await assert.rejects(
      () =>
        resolveCaller(
          { organizationId: "org_1", sessionCookie: "s=abc" },
          { fetch: fetchImpl },
        ),
      /whoami failed/,
    );
  });
});
