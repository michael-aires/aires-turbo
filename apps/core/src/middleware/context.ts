import type { Context, MiddlewareHandler } from "hono";

import { verifyAgentJwt } from "@acme/auth/verify-agent-jwt";
import type { ActorContext } from "@acme/auth";
import { resolveOrgId } from "@acme/auth/org-resolver";

import { auth } from "../auth.js";
import { env } from "../env.js";

export interface CoreHonoEnv {
  Variables: {
    actor: ActorContext | undefined;
    requestId: string;
  };
}

/**
 * Resolve the caller into a typed `ActorContext`:
 * - user session (Better-Auth cookie)
 * - agent JWT (Authorization: Bearer eyJ...)
 * - API key (x-api-key header, delegated to Better-Auth apiKey plugin)
 */
export const authContext: MiddlewareHandler<CoreHonoEnv> = async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);

  const authz = c.req.header("authorization");
  if (authz?.startsWith("Bearer ")) {
    const token = authz.slice("Bearer ".length);
    try {
      const actor = await verifyAgentJwt(token, {
        authBaseUrl: `${env.CORE_PUBLIC_URL}/api/auth`,
      });
      c.set("actor", actor);
      return next();
    } catch {
      // fall through — may still be a session cookie
    }
  }

  const session = await auth.api
    .getSession({ headers: c.req.raw.headers })
    .catch(() => null);

  if (session?.user) {
    const actor: ActorContext = {
      type: "user",
      userId: session.user.id,
      sessionId: session.session.id,
    };

    const requestedOrgId = c.req.header("x-organization-id");
    if (requestedOrgId) {
      const resolvedOrgId = await resolveOrgId(actor, requestedOrgId);
      if (!resolvedOrgId) {
        return c.json({ error: "organization access denied" }, 403);
      }
      actor.orgId = resolvedOrgId;
    } else {
      actor.orgId = await resolveOrgId(actor);
    }

    c.set("actor", actor);
    return next();
  }

  return next();
};

export const requireActor: MiddlewareHandler<CoreHonoEnv> = async (c, next) => {
  const actor = c.get("actor");
  if (!actor) {
    return c.json({ error: "unauthenticated" }, 401);
  }
  return next();
};

export function getRequiredActor(c: Context<CoreHonoEnv>): ActorContext {
  const actor = c.get("actor");
  if (!actor) {
    throw new Error("authenticated actor missing from request context");
  }
  return actor;
}
