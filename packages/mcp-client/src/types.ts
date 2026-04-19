/**
 * Shape of the MCP client surface we care about. Kept minimal so we can swap
 * the real `@modelcontextprotocol/sdk` client for a fake in unit tests
 * without pulling in the SSE transport.
 */
export interface AiresMcpClient {
  listTools(): Promise<McpToolDescriptor[]>;
  callTool(toolName: string, input: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MakeClientInput {
  mcpUrl: string;
  agentJwt: string;
  name?: string;
}

export type McpClientFactory = (input: MakeClientInput) => Promise<AiresMcpClient>;

export interface LoadToolsInput {
  mcpUrl: string;
  agentJwt: string;
  clientFactory?: McpClientFactory;
}

export interface AiSdkTool {
  description: string;
  parameters: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface LoadedTools {
  tools: Record<string, AiSdkTool>;
  close: () => Promise<void>;
}

/**
 * Thrown when the MCP server refuses a tool call because the JWT lacks the
 * required scope. Normal Error subclass so AI SDK can serialise it as a
 * tool-error step without crashing the run.
 */
export class McpScopeError extends Error {
  readonly code = "mcp_scope_denied";
  readonly toolName: string;
  readonly requiredScope: string | undefined;

  constructor(toolName: string, requiredScope?: string, message?: string) {
    super(
      message ??
        `mcp tool "${toolName}" requires scope "${
          requiredScope ?? "<unknown>"
        }" which the current agent JWT does not carry`,
    );
    this.name = "McpScopeError";
    this.toolName = toolName;
    this.requiredScope = requiredScope;
  }
}
