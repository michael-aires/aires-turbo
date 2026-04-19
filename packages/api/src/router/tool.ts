import type { TRPCRouterRecord } from "@trpc/server";
import { eq } from "drizzle-orm";

import { toolRegistry } from "@acme/agents/tools";
import { tool as toolTable } from "@acme/db/schema";

import { protectedProcedure } from "../trpc";

/**
 * Catalog-only tRPC surface. Tool execution MUST go through the authenticated
 * REST adapter at `POST /api/v1/tools/:name` on `apps/core`, which enforces
 * actor-scoped tenant isolation, scope checks, rate limits, and audit writes.
 */
export const toolRouter = {
  /** Persisted catalog for the Admin UI. */
  catalog: protectedProcedure.query(({ ctx }) =>
    ctx.db.select().from(toolTable).where(eq(toolTable.enabled, true)),
  ),

  /** In-memory registry snapshot — used by MCP server on boot. */
  inMemory: protectedProcedure.query(() =>
    toolRegistry.list().map((t) => ({
      name: t.name,
      displayName: t.displayName,
      description: t.description,
      category: t.category,
      requiredScopes: t.requiredScopes,
      requiresApproval: t.requiresApproval,
      costTier: t.costTier,
    })),
  ),
} satisfies TRPCRouterRecord;
