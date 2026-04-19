import type { TRPCRouterRecord } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

import { subscription } from "@acme/db/schema";

import { protectedProcedure } from "../trpc.js";

export const subscriptionRouter = {
  list: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(subscription)
        .where(eq(subscription.organizationId, input.organizationId)),
    ),

  create: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        url: z.string().url(),
        secret: z.string().min(16),
        description: z.string().max(256).optional(),
        eventTypes: z.array(z.string()).default(["*"]),
        projectIds: z.array(z.string().uuid()).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db
        .insert(subscription)
        .values({
          organizationId: input.organizationId,
          url: input.url,
          secret: input.secret,
          description: input.description,
          eventFilter: {
            eventTypes: input.eventTypes,
            projectIds: input.projectIds,
          },
        })
        .returning(),
    ),

  setActive: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        active: z.boolean(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(subscription)
        .set({ active: input.active })
        .where(eq(subscription.id, input.id)),
    ),
} satisfies TRPCRouterRecord;
