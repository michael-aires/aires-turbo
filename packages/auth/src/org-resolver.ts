import { eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { member } from "@acme/db/schema";

import type { ActorContext } from "./index.js";

const USER_ORG_CACHE_MAX = 5_000;
const userOrgCache = new Map<string, string>();

/**
 * Resolve an actor's `organizationId`:
 *   - agent / api-key actors: the id is baked into the token, no lookup.
 *   - user actors: one cached lookup into `member` (primary org).
 *
 * Returns `undefined` only if a user has no org membership yet.
 */
export async function resolveOrgId(
  actor: ActorContext,
): Promise<string | undefined> {
  if (actor.orgId) return actor.orgId;
  if (actor.type !== "user") return undefined;

  const cached = userOrgCache.get(actor.userId);
  if (cached) return cached;

  const rows = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, actor.userId))
    .limit(1);

  const orgId = rows[0]?.organizationId;
  if (!orgId) return undefined;

  if (userOrgCache.size >= USER_ORG_CACHE_MAX) {
    const firstKey = userOrgCache.keys().next().value;
    if (firstKey) userOrgCache.delete(firstKey);
  }
  userOrgCache.set(actor.userId, orgId);
  return orgId;
}

/** Test-only: drop the in-process cache. */
export function clearOrgResolverCache(): void {
  userOrgCache.clear();
}
