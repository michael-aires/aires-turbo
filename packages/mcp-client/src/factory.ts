import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

import type { AiresMcpClient, MakeClientInput } from "./types.js";

/**
 * Default factory. Opens an SSE transport against the Aires MCP server and
 * injects the agent JWT via the Authorization header on every request.
 *
 * The JWT is the only authentication primitive the MCP server inspects:
 * no cookies, no URL query tokens, no shared secrets.
 */
export async function createSseMcpClient({
  mcpUrl,
  agentJwt,
  name = "aires-agent-harness",
}: MakeClientInput): Promise<AiresMcpClient> {
  if (!mcpUrl) throw new Error("mcpUrl is required");
  if (!agentJwt) throw new Error("agentJwt is required");

  const transport = new SSEClientTransport(new URL(mcpUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${agentJwt}`,
      },
    },
  });

  const client = new Client(
    { name, version: "0.1.0" },
    { capabilities: {} },
  );

  await client.connect(transport);

  return {
    async listTools() {
      const res = await client.listTools();
      return res.tools.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: t.inputSchema as Record<string, unknown>,
      }));
    },
    async callTool(toolName, input) {
      const res = await client.callTool({ name: toolName, arguments: input });
      return res as unknown;
    },
    async close() {
      await client.close();
    },
  };
}
