import type { TRPCRouterRecord } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";

import { CreateTaskSchema, task } from "@acme/db/schema";

import { protectedProcedure } from "../trpc.js";

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
    .query(({ ctx, input }) => {
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
    .mutation(({ ctx, input }) => {
      return ctx.db.insert(task).values(input).returning();
    }),

  setStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["open", "in_progress", "blocked", "done", "cancelled"]),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db
        .update(task)
        .set({ status: input.status })
        .where(eq(task.id, input.id));
    }),
} satisfies TRPCRouterRecord;
