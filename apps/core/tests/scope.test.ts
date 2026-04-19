/**
 * Unit tests for the scope gate. Pure function — no DB, no fetch.
 * Run: `pnpm -F @acme/core tsx --test tests/scope.test.ts`
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import type { ActorContext } from "@acme/auth";

import { hasScope } from "../src/lib/scope.js";

function agentActor(scopes: string[]): ActorContext {
  return {
    type: "agent",
    agentId: "11111111-1111-1111-1111-111111111111",
    tokenId: "jti-test",
    scopes,
    projectIds: [],
    orgId: "22222222-2222-2222-2222-222222222222",
  };
}

const userActor: ActorContext = {
  type: "user",
  userId: "user-1",
  sessionId: "session-1",
  orgId: "22222222-2222-2222-2222-222222222222",
};

describe("hasScope", () => {
  it("always allows user actors (session-authenticated)", () => {
    assert.equal(hasScope(userActor, ["email:send"]), true);
    assert.equal(hasScope(userActor, ["contract:send", "report:fetch"]), true);
  });

  it("allows the tools:* super-scope for agents", () => {
    assert.equal(hasScope(agentActor(["tools:*"]), ["email:send"]), true);
    assert.equal(
      hasScope(agentActor(["tools:*"]), ["contract:send", "report:fetch"]),
      true,
    );
  });

  it("matches literal scopes", () => {
    assert.equal(
      hasScope(agentActor(["email:send"]), ["email:send"]),
      true,
    );
  });

  it("matches category wildcards", () => {
    assert.equal(
      hasScope(agentActor(["email:*"]), ["email:send"]),
      true,
    );
    assert.equal(
      hasScope(agentActor(["email:*"]), ["email:send", "email:read"]),
      true,
    );
  });

  it("denies missing scopes", () => {
    assert.equal(
      hasScope(agentActor(["email:send"]), ["contract:send"]),
      false,
    );
  });

  it("denies if ANY required scope is missing", () => {
    assert.equal(
      hasScope(agentActor(["email:send"]), ["email:send", "contract:send"]),
      false,
    );
  });

  it("denies an agent with empty scopes", () => {
    assert.equal(hasScope(agentActor([]), ["email:send"]), false);
  });

  it("does NOT cross category boundaries on wildcards", () => {
    assert.equal(
      hasScope(agentActor(["email:*"]), ["contract:send"]),
      false,
    );
  });

  it("accepts legacy scope aliases for compatibility", () => {
    assert.equal(
      hasScope(agentActor(["contracts:send"]), ["contract:send"]),
      true,
    );
    assert.equal(
      hasScope(agentActor(["reports:read"]), ["report:fetch"]),
      true,
    );
    assert.equal(
      hasScope(agentActor(["kb:read"]), ["kb:search"]),
      true,
    );
  });
});
