import type { TRPCRouterRecord } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import { auditLog } from "@acme/db/schema";

import { assertOrganizationAccess } from "../authz.js";
import { protectedProcedure } from "../trpc.js";

export const auditRouter = {
  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        actorType: z.enum(["user", "agent", "system"]).optional(),
        tool: z.string().optional(),
        result: z.enum(["ok", "error", "denied"]).optional(),
        limit: z.number().int().min(1).max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertOrganizationAccess(ctx, input.organizationId);

      const filters = [eq(auditLog.organizationId, input.organizationId)];
      if (input.actorType) filters.push(eq(auditLog.actorType, input.actorType));
      if (input.tool) filters.push(eq(auditLog.tool, input.tool));
      if (input.result) filters.push(eq(auditLog.result, input.result));

      return ctx.db
        .select()
        .from(auditLog)
        .where(and(...filters))
        .orderBy(desc(auditLog.createdAt))
        .limit(input.limit);
    }),

  stats: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertOrganizationAccess(ctx, input.organizationId);

      const rows = await ctx.db
        .select({
          result: auditLog.result,
          tool: auditLog.tool,
          count: sql<number>`count(*)::int`,
        })
        .from(auditLog)
        .where(eq(auditLog.organizationId, input.organizationId))
        .groupBy(auditLog.result, auditLog.tool);
      return rows;
    }),
} satisfies TRPCRouterRecord;
