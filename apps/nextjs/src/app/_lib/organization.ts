import "server-only";

import { cache } from "react";

import { db } from "@acme/db/client";
import { eq } from "@acme/db";
import { member } from "@acme/db/schema";

import { getSession } from "~/auth/server";

export const getAccessibleOrganizationIds = cache(async (): Promise<string[]> => {
  const session = await getSession();
  const userId = session?.user.id;
  if (!userId) return [];

  const rows = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId));

  return rows.map((row) => row.organizationId);
});

export async function getSelectedOrganizationId(
  requestedOrgId?: string,
): Promise<string | null> {
  const orgIds = await getAccessibleOrganizationIds();
  if (orgIds.length === 0) return null;

  if (requestedOrgId) {
    return orgIds.includes(requestedOrgId) ? requestedOrgId : null;
  }

  return orgIds[0] ?? null;
}
