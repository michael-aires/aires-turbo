import { createLogger } from "@acme/observability";

import { createSseMcpClient } from "./factory.js";
import type { AiSdkTool, AiresMcpClient, LoadToolsInput, LoadedTools } from "./types.js";
import { McpScopeError } from "./types.js";

export * from "./types.js";
export { createSseMcpClient } from "./factory.js";

const logger = createLogger("mcp-client");

/**
 * Open an MCP client against Aires core, list its tools, and return an
 * AI-SDK-compatible tool map. Each returned tool's `execute` is a closure
 * that calls back into the MCP session with the bound JWT — the harness
 * never has to know about MCP framing.
 *
 * The caller is responsible for invoking `close()` in the streamText
 * `onFinish`/`onError` callbacks so we don't leak MCP sessions.
 */
export async function loadAiresMcpTools(input: LoadToolsInput): Promise<LoadedTools> {
  const factory = input.clientFactory ?? createSseMcpClient;

  const client: AiresMcpClient = await factory({
    mcpUrl: input.mcpUrl,
    agentJwt: input.agentJwt,
  });

  let descriptors;
  try {
    descriptors = await client.listTools();
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "mcp-client.listTools.failed",
    );
    await client.close().catch(() => {
      // already-failed path; primary error is more useful
    });
    throw err;
  }

  const tools: Record<string, AiSdkTool> = {};
  for (const d of descriptors) {
    tools[d.name] = {
      description: d.description,
      parameters: d.inputSchema,
      execute: async (args: Record<string, unknown>) => {
        try {
          return await client.callTool(d.name, args);
        } catch (err) {
          if (err instanceof McpScopeError) throw err;
          if (err instanceof Error && /scope/i.test(err.message)) {
            throw new McpScopeError(d.name, undefined, err.message);
          }
          throw err;
        }
      },
    };
  }

  return {
    tools,
    close: () => client.close(),
  };
}
