import { eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { tool as toolTable } from "@acme/db/schema";

import { toolRegistry } from "./registry.js";

/**
 * Upsert every in-memory tool definition into the Postgres catalog so the
 * MCP server and Admin UI can discover them. Safe to call on every boot —
 * the `tool.name` uniqueness keeps this idempotent.
 */
export async function syncToolCatalog(): Promise<number> {
  const tools = toolRegistry.list();
  if (tools.length === 0) return 0;

  let synced = 0;
  for (const tool of tools) {
    const existing = await db
      .select()
      .from(toolTable)
      .where(eq(toolTable.name, tool.name))
      .limit(1);

    const values = {
      name: tool.name,
      displayName: tool.displayName,
      description: tool.description,
      category: tool.category,
      inputSchema: zodSchemaToJson(tool.inputSchema),
      outputSchema: zodSchemaToJson(tool.outputSchema),
      requiredScopes: tool.requiredScopes,
      requiresApproval: tool.requiresApproval,
      costTier: tool.costTier,
      enabled: true,
    };

    if (existing[0]) {
      await db
        .update(toolTable)
        .set(values)
        .where(eq(toolTable.id, existing[0].id));
    } else {
      await db.insert(toolTable).values(values);
    }
    synced += 1;
  }
  return synced;
}

function zodSchemaToJson(schema: unknown): Record<string, unknown> {
  // Lightweight placeholder — real implementation should use
  // `zod-to-json-schema`. Kept dependency-free so we don't expand the bundle
  // for a one-shot catalog sync. Apps that need full JSON Schema export can
  // pass a pre-built schema map.
  return { $zod: true, note: "use zod-to-json-schema in production", schema };
}
