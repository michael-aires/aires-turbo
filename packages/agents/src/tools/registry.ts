import type { ToolDefinition } from "./types";

/**
 * Static in-memory tool registry. Apps register tool definitions at startup;
 * the DB `tool` table is synced from this registry so REST + tRPC + MCP all
 * see the same catalog (and RBAC is consistent).
 */
class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  byCategory(category: string): ToolDefinition[] {
    return this.list().filter((t) => t.category === category);
  }
}

export const toolRegistry = new ToolRegistry();
