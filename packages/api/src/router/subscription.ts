import type { TRPCRouterRecord } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

import { subscription } from "@acme/db/schema";

import {
  assertOrganizationAccess,
  assertRowOrganizationAccess,
} from "../authz";
import { validateWebhookTarget } from "../webhook-security";
import { protectedProcedure } from "../trpc";

export const subscriptionRouter = {
  list: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertOrganizationAccess(ctx, input.organizationId);

      return ctx.db
        .select()
        .from(subscription)
        .where(eq(subscription.organizationId, input.organizationId));
    }),

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
    .mutation(async ({ ctx, input }) => {
      await assertOrganizationAccess(ctx, input.organizationId);
      const url = await validateWebhookTarget(input.url);

      return ctx.db
        .insert(subscription)
        .values({
          organizationId: input.organizationId,
          url,
          secret: input.secret,
          description: input.description,
          eventFilter: {
            eventTypes: input.eventTypes,
            projectIds: input.projectIds,
          },
        })
        .returning();
    }),

  setActive: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        active: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.query.subscription.findFirst({
        where: eq(subscription.id, input.id),
      });
      await assertRowOrganizationAccess(ctx, row?.organizationId);

      return ctx.db
        .update(subscription)
        .set({ active: input.active })
        .where(eq(subscription.id, input.id));
    }),
} satisfies TRPCRouterRecord;
