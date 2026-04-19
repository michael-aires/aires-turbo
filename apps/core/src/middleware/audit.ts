import type { MiddlewareHandler } from "hono";

import { writeAudit } from "@acme/agents";
import { resolveOrgId } from "@acme/auth/org-resolver";
import { createLogger } from "@acme/observability";

import type { CoreHonoEnv } from "./context.js";

const logger = createLogger("core.audit");

/**
 * Terminal audit writer. Best-effort — never fails the request.
 * Silent skip when the caller is unauthenticated or has no org yet
 * (the only pre-org surface is auth + health endpoints).
 */
export const auditRequest: MiddlewareHandler<CoreHonoEnv> = async (c, next) => {
  const start = Date.now();
  await next();
  const durationMs = Date.now() - start;
  const actor = c.get("actor");
  if (!actor) return;

  const organizationId = await resolveOrgId(actor);
  if (!organizationId) return;

  try {
    await writeAudit(
      {
        actor,
        organizationId,
        requestId: c.get("requestId"),
      },
      {
        action: `${c.req.method} ${c.req.path}`,
        result: c.res.status >= 400 ? "error" : "ok",
        durationMs,
        metadata: { status: c.res.status },
      },
    );
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? { message: err.message, stack: err.stack } : String(err) },
      "audit write failed",
    );
  }
};
