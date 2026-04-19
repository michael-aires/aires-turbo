import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import type { db } from "@acme/db/client";
import { member } from "@acme/db/schema";

export interface SessionBoundContext {
  db: typeof db;
  session:
    | {
        user: {
          id: string;
        };
      }
    | null;
}

export function requireUserId(ctx: SessionBoundContext): string {
  const userId = ctx.session?.user.id;
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return userId;
}

export async function listAuthorizedOrganizationIds(
  ctx: SessionBoundContext,
): Promise<string[]> {
  const userId = requireUserId(ctx);

  const rows = await ctx.db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId));

  return rows.map((row) => row.organizationId);
}

export async function assertOrganizationAccess(
  ctx: SessionBoundContext,
  organizationId: string,
): Promise<void> {
  const userId = requireUserId(ctx);

  const [row] = await ctx.db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(
      and(
        eq(member.userId, userId),
        eq(member.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "organization access denied",
    });
  }
}

export async function assertRowOrganizationAccess(
  ctx: SessionBoundContext,
  organizationId: string | null | undefined,
): Promise<void> {
  if (!organizationId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "organization-scoped record not found",
    });
  }

  await assertOrganizationAccess(ctx, organizationId);
}
