import type {
  AiresMcpClient,
  MakeClientInput,
  McpClientFactory,
  McpToolDescriptor,
} from "./types";
import { McpScopeError } from "./types";

export interface FakeToolCall {
  toolName: string;
  input: Record<string, unknown>;
  jwt: string;
}

export interface FakeMcpOptions {
  /** Tools visible via `.listTools()`. */
  tools?: McpToolDescriptor[];
  /** Tools that deny on call — simulates scope-denied. */
  denyScopes?: Record<string, string>;
  /** Record of every call made via the returned client. */
  callLog?: FakeToolCall[];
}

/**
 * In-memory MCP client for unit tests. Records every tool call made against
 * it so tests can assert on the JWT, tool name, and input. Supports
 * simulating scope-denied errors via `denyScopes`.
 */
export function createFakeMcpClient(opts: FakeMcpOptions = {}): {
  factory: McpClientFactory;
  calls: FakeToolCall[];
} {
  const calls = opts.callLog ?? [];
  const tools = opts.tools ?? [];
  const denyScopes = opts.denyScopes ?? {};

  const factory: McpClientFactory = async (
    input: MakeClientInput,
  ): Promise<AiresMcpClient> => {
    if (!input.agentJwt) {
      throw new Error("fake-mcp: agentJwt must be provided");
    }

    return {
      async listTools() {
        return tools;
      },
      async callTool(toolName, args) {
        calls.push({ toolName, input: args, jwt: input.agentJwt });
        const deniedScope = denyScopes[toolName];
        if (deniedScope) throw new McpScopeError(toolName, deniedScope);
        return { ok: true, echo: args };
      },
      async close() {
        // noop
      },
    };
  };

  return { factory, calls };
}
