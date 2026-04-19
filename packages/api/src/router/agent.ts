import type { TRPCRouterRecord } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

import { agent, agentToken } from "@acme/db/schema";

import { protectedProcedure } from "../trpc.js";

export const agentRouter = {
  list: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(agent)
        .where(eq(agent.organizationId, input.organizationId))
        .orderBy(desc(agent.createdAt)),
    ),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.db.query.agent.findFirst({ where: eq(agent.id, input.id) }),
    ),

  create: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        name: z.string().min(1).max(128),
        description: z.string().max(2000).optional(),
        scopes: z.array(z.string()).default([]),
        projectIds: z.array(z.string().uuid()).default([]),
        rateLimitTier: z
          .enum(["default", "low", "high", "unlimited"])
          .default("default"),
        spendCapCents: z.number().int().nonnegative().default(0),
        model: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user) throw new Error("unauthenticated");
      const [row] = await ctx.db
        .insert(agent)
        .values({
          organizationId: input.organizationId,
          ownerUserId: ctx.session.user.id,
          name: input.name,
          description: input.description,
          scopes: input.scopes,
          projectIds: input.projectIds,
          rateLimitTier: input.rateLimitTier,
          spendCapCents: input.spendCapCents,
          model: input.model,
          memoryNamespace: `agent-${input.name}`.slice(0, 128),
        })
        .returning();
      return row;
    }),

  tokens: protectedProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(agentToken)
        .where(eq(agentToken.agentId, input.agentId))
        .orderBy(desc(agentToken.issuedAt)),
    ),

  revokeToken: protectedProcedure
    .input(z.object({ tokenId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(agentToken)
        .set({ revokedAt: new Date() })
        .where(eq(agentToken.id, input.tokenId)),
    ),
} satisfies TRPCRouterRecord;
