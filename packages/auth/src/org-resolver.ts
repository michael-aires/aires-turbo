import { eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { member } from "@acme/db/schema";

import type { ActorContext } from "./index";

/**
 * Resolve an actor's `organizationId`:
 *   - agent actors: the id is baked into the token, no lookup.
 *   - user actors:
 *     - explicit org selection must match a membership row
 *     - implicit selection succeeds only when the user belongs to exactly one org
 *
 * Returns `undefined` when the actor has no organization, or when a user has
 * multiple orgs but did not choose one explicitly.
 */
export async function resolveOrgId(
  actor: ActorContext,
  requestedOrgId?: string,
): Promise<string | undefined> {
  if (actor.orgId) return actor.orgId;
  if (actor.type !== "user") return undefined;

  const orgIds = await listUserOrganizationIds(actor.userId);
  if (requestedOrgId) {
    return orgIds.includes(requestedOrgId) ? requestedOrgId : undefined;
  }

  return orgIds.length === 1 ? orgIds[0] : undefined;
}

export async function listUserOrganizationIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId));

  return rows.map((row) => row.organizationId);
}

export async function hasUserOrganizationAccess(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const rows = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId));

  return rows.some((row) => row.organizationId === organizationId);
}

/** Test-only: drop the in-process cache. */
export function clearOrgResolverCache(): void {
  // Compatibility no-op. The resolver no longer keeps mutable in-process state.
}
