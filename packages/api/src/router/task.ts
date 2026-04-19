import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

import { CreateTaskSchema, task } from "@acme/db/schema";

import {
  assertOrganizationAccess,
  assertRowOrganizationAccess,
} from "../authz";
import { protectedProcedure } from "../trpc";

export const taskRouter = {
  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        status: z
          .enum(["open", "in_progress", "blocked", "done", "cancelled"])
          .optional(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertOrganizationAccess(ctx, input.organizationId);

      const where = input.status
        ? and(
            eq(task.organizationId, input.organizationId),
            eq(task.status, input.status),
          )
        : eq(task.organizationId, input.organizationId);
      return ctx.db
        .select()
        .from(task)
        .where(where)
        .orderBy(desc(task.createdAt))
        .limit(input.limit);
    }),

  create: protectedProcedure
    .input(CreateTaskSchema)
    .mutation(async ({ ctx, input }) => {
      await assertOrganizationAccess(ctx, input.organizationId);
      return ctx.db.insert(task).values(input).returning();
    }),

  setStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["open", "in_progress", "blocked", "done", "cancelled"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.query.task.findFirst({
        where: eq(task.id, input.id),
      });
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "task not found" });
      }
      await assertRowOrganizationAccess(ctx, row.organizationId);

      return ctx.db
        .update(task)
        .set({ status: input.status })
        .where(eq(task.id, input.id));
    }),
} satisfies TRPCRouterRecord;
