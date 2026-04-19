import { Hono } from "hono";

import { hitRateLimit, toolRegistry, writeAudit } from "@acme/agents";
import { resolveOrgId } from "@acme/auth/org-resolver";

import { hasScope } from "../lib/scope.js";
import type { CoreHonoEnv } from "../middleware/context.js";
import { requireActor } from "../middleware/context.js";

const TOOL_RATE_LIMIT_WINDOW_MS = 60_000;
const TOOL_RATE_LIMIT_MAX = 60;

export const toolRest = new Hono<CoreHonoEnv>()
  .get("/", (c) =>
    c.json(
      toolRegistry.list().map((t) => ({
        name: t.name,
        displayName: t.displayName,
        description: t.description,
        category: t.category,
        requiredScopes: t.requiredScopes,
        requiresApproval: t.requiresApproval,
        costTier: t.costTier,
      })),
    ),
  )
  .use(requireActor)
  .post("/:name", async (c) => {
    const name = c.req.param("name");
    const tool = toolRegistry.get(name);
    if (!tool) return c.json({ error: `tool not registered: ${name}` }, 404);

    const actor = c.get("actor");
    const requestId = c.get("requestId");

    const organizationId = await resolveOrgId(actor);
    if (!organizationId) {
      return c.json({ error: "organization missing for actor" }, 400);
    }

    if (!hasScope(actor, tool.requiredScopes)) {
      await writeAudit(
        { actor, organizationId, requestId },
        {
          tool: name,
          action: `tool.${name}`,
          result: "denied",
          errorCode: "scope",
        },
      );
      return c.json({ error: "insufficient scope" }, 403);
    }

    if (actor.type === "agent") {
      const rateKey = `agent:${actor.agentId}:tool:${name}`;
      const limited = await hitRateLimit(rateKey, {
        windowMs: TOOL_RATE_LIMIT_WINDOW_MS,
        max: TOOL_RATE_LIMIT_MAX,
      });
      if (!limited.allowed) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((limited.resetAt - Date.now()) / 1000),
        );
        c.header("retry-after", String(retryAfterSeconds));
        return c.json({ error: "rate limited", retryAfterSeconds }, 429);
      }
    }

    const input = await c.req.json().catch(() => ({}));
    const parsed = tool.inputSchema.safeParse(input);
    if (!parsed.success) {
      return c.json({ error: "invalid input", details: parsed.error.issues }, 400);
    }

    try {
      const result = await tool.handler({
        input: parsed.data,
        ctx: { actor, organizationId, requestId },
      });
      return c.json(result);
    } catch (err) {
      await writeAudit(
        { actor, organizationId, requestId },
        {
          tool: name,
          action: `tool.${name}`,
          result: "error",
          errorCode: String(err).slice(0, 64),
        },
      );
      return c.json({ error: String(err) }, 500);
    }
  });
