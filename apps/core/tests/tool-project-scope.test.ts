import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import type { ActorContext } from "@acme/auth";

import { resolveToolProjectScope } from "../src/lib/tool-project-scope.js";

describe("resolveToolProjectScope", () => {
  it("binds a single-project agent to its only project when input omits one", () => {
    const actor: ActorContext = {
      type: "agent",
      agentId: "agent-1",
      tokenId: "token-1",
      scopes: [],
      projectIds: ["11111111-1111-1111-1111-111111111111"],
      orgId: "22222222-2222-2222-2222-222222222222",
    };

    assert.deepEqual(resolveToolProjectScope(actor, {}), {
      projectId: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("rejects a project outside the agent scope", () => {
    const actor: ActorContext = {
      type: "agent",
      agentId: "agent-1",
      tokenId: "token-1",
      scopes: [],
      projectIds: ["11111111-1111-1111-1111-111111111111"],
      orgId: "22222222-2222-2222-2222-222222222222",
    };

    assert.deepEqual(
      resolveToolProjectScope(actor, {
        projectId: "33333333-3333-3333-3333-333333333333",
      }),
      { error: "forbidden" },
    );
  });

  it("allows users to pass an explicit project without agent scoping", () => {
    const actor: ActorContext = {
      type: "user",
      userId: "user-1",
      sessionId: "session-1",
      orgId: "22222222-2222-2222-2222-222222222222",
    };

    assert.deepEqual(
      resolveToolProjectScope(actor, {
        projectId: "33333333-3333-3333-3333-333333333333",
      }),
      { projectId: "33333333-3333-3333-3333-333333333333" },
    );
  });
});
