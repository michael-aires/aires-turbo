import type { TRPCRouterRecord } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

import { activity, CreateActivitySchema } from "@acme/db/schema";
import { EventType, publish } from "@acme/events";

import { protectedProcedure } from "../trpc.js";

export const activityRouter = {
  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        contactId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(({ ctx, input }) => {
      const where = input.contactId
        ? and(
            eq(activity.organizationId, input.organizationId),
            eq(activity.contactId, input.contactId),
          )
        : eq(activity.organizationId, input.organizationId);

      return ctx.db
        .select()
        .from(activity)
        .where(where)
        .orderBy(desc(activity.occurredAt))
        .limit(input.limit);
    }),

  log: protectedProcedure
    .input(CreateActivitySchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [row] = await tx.insert(activity).values(input).returning();
        if (!row) throw new Error("failed to insert activity");

        await publish(tx, {
          organizationId: row.organizationId,
          eventType: EventType.ActivityLogged,
          aggregateType: "activity",
          aggregateId: row.id,
          payload: {
            activityId: row.id,
            contactId: row.contactId ?? undefined,
            kind: row.kind,
          },
          actor: {
            type: "user",
            id: ctx.session?.user.id ?? "anonymous",
          },
        });
        return row;
      });
    }),
} satisfies TRPCRouterRecord;
