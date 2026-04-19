import { and, eq, isNull } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { db } from "@acme/db/client";
import { agent, agentToken } from "@acme/db/schema";

import type { ActorContext } from "./index";

export interface VerifyAgentJwtOptions {
  /** Public Better-Auth base URL — the gateway uses this to fetch JWKs. */
  authBaseUrl: string;
  audience?: string;
  issuer?: string;
  /**
   * If true, skip the DB revocation check. Only set in very hot paths where
   * you've already verified within the last few seconds.
   */
  skipRevocationCheck?: boolean;
}

let jwksCache: ReturnType<typeof createRemoteJWKSet> | undefined;

/**
 * Validate an agent-scoped JWT issued by Better-Auth's `jwt()` plugin.
 *
 * Returns a typed `ActorContext` the gateway middleware can attach to the
 * request. Throws on malformed / expired / revoked tokens — callers should
 * translate to a 401.
 */
export async function verifyAgentJwt(
  token: string,
  options: VerifyAgentJwtOptions,
): Promise<Extract<ActorContext, { type: "agent" }>> {
  jwksCache ??= createRemoteJWKSet(
    new URL(`${options.authBaseUrl}/jwks`),
  );

  const { payload } = await jwtVerify(token, jwksCache, {
    audience: options.audience ?? "aires-crm",
    issuer: options.issuer,
  });

  const subjectType = payload.subject_type ?? payload.subjectType;
  if (subjectType !== "agent") {
    throw new Error("jwt subject is not an agent");
  }

  const agentId = payload.agent_id ?? payload.agentId ?? payload.sub;
  const tokenId = payload.jti;
  if (typeof agentId !== "string" || typeof tokenId !== "string") {
    throw new Error("jwt is missing agent_id or jti");
  }

  if (!options.skipRevocationCheck) {
    const [tokenRow] = await db
      .select({
        agentId: agentToken.agentId,
        revokedAt: agentToken.revokedAt,
        agentStatus: agent.status,
      })
      .from(agentToken)
      .innerJoin(agent, eq(agent.id, agentToken.agentId))
      .where(
        and(
          eq(agentToken.jti, tokenId),
          eq(agentToken.agentId, agentId),
          isNull(agentToken.revokedAt),
        ),
      )
      .limit(1);

    if (!tokenRow) throw new Error("agent token revoked or unknown");
    if (tokenRow.agentStatus !== "active") {
      throw new Error(`agent is ${tokenRow.agentStatus}`);
    }
  }

  return {
    type: "agent",
    agentId,
    tokenId,
    scopes: Array.isArray(payload.scopes) ? (payload.scopes as string[]) : [],
    projectIds: Array.isArray(payload.project_ids)
      ? (payload.project_ids as string[])
      : [],
    orgId: typeof payload.org_id === "string" ? payload.org_id : undefined,
  };
}
