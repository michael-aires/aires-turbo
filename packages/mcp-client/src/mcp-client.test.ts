import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { createFakeMcpClient } from "./fake.js";
import { loadAiresMcpTools, McpScopeError } from "./index.js";

describe("loadAiresMcpTools", () => {
  it("throws when agentJwt is empty", async () => {
    const { factory } = createFakeMcpClient({
      tools: [{ name: "contact.search", description: "search", inputSchema: {} }],
    });

    await assert.rejects(
      () =>
        loadAiresMcpTools({
          mcpUrl: "http://mcp.local/sse",
          agentJwt: "",
          clientFactory: factory,
        }),
      /agentJwt/,
    );
  });

  it("injects the agent JWT into every tool call", async () => {
    const { factory, calls } = createFakeMcpClient({
      tools: [{ name: "contact.search", description: "search", inputSchema: {} }],
    });

    const { tools, close } = await loadAiresMcpTools({
      mcpUrl: "http://mcp.local/sse",
      agentJwt: "jwt-abc",
      clientFactory: factory,
    });

    const tool = tools["contact.search"];
    assert.ok(tool, "contact.search tool should be present");
    assert.equal(tool.description, "search");

    const result = await tool.execute({ q: "alice" });
    assert.deepEqual(result, { ok: true, echo: { q: "alice" } });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.toolName, "contact.search");
    assert.equal(calls[0]!.jwt, "jwt-abc");
    assert.deepEqual(calls[0]!.input, { q: "alice" });

    await close();
  });

  it("surfaces scope-denied as McpScopeError for the agent loop to handle", async () => {
    const { factory } = createFakeMcpClient({
      tools: [{ name: "contract.send", description: "send", inputSchema: {} }],
      denyScopes: { "contract.send": "contract:send" },
    });

    const { tools, close } = await loadAiresMcpTools({
      mcpUrl: "http://mcp.local/sse",
      agentJwt: "jwt-weak",
      clientFactory: factory,
    });

    const tool = tools["contract.send"];
    assert.ok(tool);

    await assert.rejects(
      () => tool.execute({ transactionId: "tx_1" }),
      (err: unknown) => {
        if (!(err instanceof McpScopeError)) return false;
        assert.equal(err.code, "mcp_scope_denied");
        assert.equal(err.toolName, "contract.send");
        assert.equal(err.requiredScope, "contract:send");
        return true;
      },
    );

    await close();
  });

  it("closes the underlying client when listTools throws", async () => {
    let closeCount = 0;
    const factory: Parameters<typeof loadAiresMcpTools>[0]["clientFactory"] =
      async () => ({
        async listTools() {
          throw new Error("boom");
        },
        async callTool() {
          return null;
        },
        async close() {
          closeCount += 1;
        },
      });

    await assert.rejects(
      () =>
        loadAiresMcpTools({
          mcpUrl: "http://mcp.local/sse",
          agentJwt: "jwt-ok",
          clientFactory: factory,
        }),
      /boom/,
    );

    assert.equal(
      closeCount,
      1,
      "close() should run once even when listTools() fails",
    );
  });
});
