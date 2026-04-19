import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import type { ActorContext } from "@acme/auth";
import type { EventEnvelope } from "@acme/events";

import { canActorAccessEvent } from "../src/lib/event-visibility.js";

const baseEnvelope: EventEnvelope = {
  id: "11111111-1111-1111-1111-111111111111",
  type: "contact.created",
  organizationId: "22222222-2222-2222-2222-222222222222",
  aggregateType: "contact",
  aggregateId: "33333333-3333-3333-3333-333333333333",
  createdAt: new Date().toISOString(),
  payload: {},
  actor: { type: "system", id: "system" },
};

describe("canActorAccessEvent", () => {
  it("allows an agent in the same org", () => {
    const actor: ActorContext = {
      type: "agent",
      agentId: "agent-1",
      tokenId: "token-1",
      scopes: [],
      projectIds: [],
      orgId: baseEnvelope.organizationId,
    };

    assert.equal(canActorAccessEvent(actor, baseEnvelope), true);
  });

  it("denies an agent from another org", () => {
    const actor: ActorContext = {
      type: "agent",
      agentId: "agent-1",
      tokenId: "token-1",
      scopes: [],
      projectIds: [],
      orgId: "99999999-9999-9999-9999-999999999999",
    };

    assert.equal(canActorAccessEvent(actor, baseEnvelope), false);
  });

  it("enforces agent project scope when an event carries projectId", () => {
    const actor: ActorContext = {
      type: "agent",
      agentId: "agent-1",
      tokenId: "token-1",
      scopes: [],
      projectIds: ["44444444-4444-4444-4444-444444444444"],
      orgId: baseEnvelope.organizationId,
    };
    const envelope: EventEnvelope = {
      ...baseEnvelope,
      payload: { projectId: "55555555-5555-5555-5555-555555555555" },
    };

    assert.equal(canActorAccessEvent(actor, envelope), false);
  });

  it("allows a user only for an accessible org", () => {
    const actor: ActorContext = {
      type: "user",
      userId: "user-1",
      sessionId: "session-1",
    };

    assert.equal(
      canActorAccessEvent(actor, baseEnvelope, [baseEnvelope.organizationId]),
      true,
    );
    assert.equal(
      canActorAccessEvent(actor, baseEnvelope, ["99999999-9999-9999-9999-999999999999"]),
      false,
    );
  });
});
