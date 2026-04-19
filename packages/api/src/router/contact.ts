import type { TRPCRouterRecord } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import type { DBTransaction } from "@acme/db/client";
import { contact, CreateContactSchema } from "@acme/db/schema";
import { EventType, publish } from "@acme/events";

import {
  assertOrganizationAccess,
  assertRowOrganizationAccess,
} from "../authz";
import { protectedProcedure } from "../trpc";

export const contactRouter = {
  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        projectId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(25),
        cursor: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertOrganizationAccess(ctx, input.organizationId);

      const whereClause = input.projectId
        ? and(
            eq(contact.organizationId, input.organizationId),
            eq(contact.projectId, input.projectId),
          )
        : eq(contact.organizationId, input.organizationId);

      const rows = await ctx.db
        .select()
        .from(contact)
        .where(whereClause)
        .orderBy(desc(contact.createdAt))
        .limit(input.limit + 1);

      const nextCursor =
        rows.length > input.limit ? rows[input.limit]?.id : undefined;
      return {
        items: rows.slice(0, input.limit),
        nextCursor,
      };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.query.contact.findFirst({
        where: eq(contact.id, input.id),
      });

      if (!row) return null;
      await assertRowOrganizationAccess(ctx, row.organizationId);
      return row;
    }),

  create: protectedProcedure
    .input(CreateContactSchema)
    .mutation(async ({ ctx, input }) => {
      await assertOrganizationAccess(ctx, input.organizationId);

      return ctx.db.transaction(async (tx: DBTransaction) => {
        const [row] = await tx.insert(contact).values(input).returning();
        if (!row) throw new Error("failed to insert contact");

        await publish(tx, {
          organizationId: row.organizationId,
          eventType: EventType.ContactCreated,
          aggregateType: "contact",
          aggregateId: row.id,
          payload: {
            contactId: row.id,
            email: row.email ?? undefined,
            phone: row.phone ?? undefined,
          },
          actor: {
            type: "user",
            id: ctx.session.user.id,
          },
        });

        return row;
      });
    }),

  count: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertOrganizationAccess(ctx, input.organizationId);

      const [row] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(contact)
        .where(eq(contact.organizationId, input.organizationId));
      return row?.count ?? 0;
    }),
} satisfies TRPCRouterRecord;
