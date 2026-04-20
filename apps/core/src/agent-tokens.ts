import { Hono } from "hono";
import { eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { agent, agentToken } from "@acme/db/schema";

import { auth } from "./auth";
import type { CoreHonoEnv } from "./middleware/context";
import { getRequiredActor, requireActor } from "./middleware/context";

/**
 * Mint a short-lived JWT for a given agent. The caller must be a human user
 * who owns the agent (or an admin). The token includes `scopes`, `agent_id`,
 * `subject_type=agent`, and `jti` — validated on every downstream call by
 * `verifyAgentJwt` using Better-Auth's JWKs endpoint.
 */
export const agentTokensRouter = new Hono<CoreHonoEnv>()
  .use(requireActor)
  .post("/:agentId/tokens", async (c) => {
    const actor = getRequiredActor(c);
    if (actor.type !== "user") {
      return c.json({ error: "only users can mint agent tokens" }, 403);
    }

    const agentId = c.req.param("agentId");
    const record = await db
      .select()
      .from(agent)
      .where(eq(agent.id, agentId))
      .limit(1);
    const row = record[0];
    if (!row) return c.json({ error: "agent not found" }, 404);
    if (row.ownerUserId !== actor.userId) {
      return c.json({ error: "forbidden" }, 403);
    }
    if (row.status !== "active") {
      return c.json({ error: `agent is ${row.status}` }, 409);
    }

    const jti = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60_000);

    // Better-Auth's jwt plugin exposes `signJWT` — include scopes + agent_id.
    // Plugin types are erased by our top-level cast in initAuth, so we access
    // this endpoint through an indexed type.
    const signJWT = (
      auth.api as unknown as {
        signJWT: (args: {
          body: { payload: Record<string, unknown> };
        }) => Promise<string | { token?: string; jwt?: string }>;
      }
    ).signJWT;
    const signed = await signJWT({
      body: {
        payload: {
          sub: row.id,
          subject_type: "agent",
          agent_id: row.id,
          org_id: row.organizationId,
          scopes: row.scopes,
          project_ids: row.projectIds,
          jti,
        },
      },
    });

    await db.insert(agentToken).values({
      agentId: row.id,
      jti,
      scopes: row.scopes,
      projectIds: row.projectIds,
      expiresAt,
    });

    const token =
      typeof signed === "string"
        ? signed
        : (signed as { token?: string; jwt?: string }).token ??
          (signed as { jwt?: string }).jwt ??
          "";

    return c.json({
      token,
      jti,
      expiresAt: expiresAt.toISOString(),
      agentId: row.id,
      scopes: row.scopes,
    });
  });
