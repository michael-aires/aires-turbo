import { z } from "zod/v4";

import { env } from "../env.js";

const WhoAmIResponseSchema = z.object({
  actor: z.union([
    z.object({
      type: z.literal("user"),
      userId: z.string(),
      sessionId: z.string(),
      orgId: z.string().optional(),
    }),
    z.object({
      type: z.literal("agent"),
      agentId: z.string(),
      tokenId: z.string(),
      scopes: z.array(z.string()),
      projectIds: z.array(z.string()),
      orgId: z.string().optional(),
    }),
  ]),
  requestId: z.string(),
});

export type ResolvedCaller =
  | { type: "user"; userId: string; orgId?: string }
  | { type: "agent"; agentId: string; scopes: string[]; orgId?: string };

export interface ResolveCallerInput {
  sessionCookie?: string;
  apiKey?: string;
  organizationId: string;
}

/**
 * Delegate auth resolution to `apps/core` so the harness stays DB-free. The
 * single-tenant deployment pins every caller to `SINGLE_ORG_ID`; we forward
 * that via `x-organization-id` so core validates membership as part of
 * resolving the session. Returns `null` when the caller is unauthenticated.
 */
export async function resolveCaller(
  input: ResolveCallerInput,
  deps: { fetch?: typeof fetch } = {},
): Promise<ResolvedCaller | null> {
  const fetchImpl = deps.fetch ?? fetch;
  if (!input.sessionCookie && !input.apiKey) return null;

  const headers: Record<string, string> = {
    "x-organization-id": input.organizationId,
  };
  if (input.sessionCookie) headers.cookie = input.sessionCookie;
  if (input.apiKey) headers["x-api-key"] = input.apiKey;

  const res = await fetchImpl(`${env.CORE_INTERNAL_URL}/api/v1/whoami`, {
    method: "GET",
    headers,
  });

  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) {
    throw new Error(
      `whoami failed: ${res.status.toString()} ${res.statusText}`,
    );
  }

  const parsed = WhoAmIResponseSchema.parse(await res.json());
  const actor = parsed.actor;
  if (actor.type === "user") {
    return { type: "user", userId: actor.userId, orgId: actor.orgId };
  }
  return {
    type: "agent",
    agentId: actor.agentId,
    scopes: actor.scopes,
    orgId: actor.orgId,
  };
}
