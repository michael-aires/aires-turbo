import { createHash } from "node:crypto";

import { db } from "@acme/db/client";
import { auditLog } from "@acme/db/schema";

import type { ToolContext } from "./tools/types";

export interface AuditLogInput {
  tool?: string;
  action: string;
  args?: unknown;
  result: "ok" | "error" | "denied";
  errorCode?: string;
  durationMs?: number;
  approvalId?: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append an audit row. Args are hashed (not stored raw) so a leaked audit
 * table doesn't expose PII by default. Structured keys mirror the operation
 * format required by the observability rule.
 */
export async function writeAudit(
  ctx: ToolContext,
  input: AuditLogInput,
): Promise<void> {
  const argsHash = input.args
    ? createHash("sha256")
        .update(JSON.stringify(input.args))
        .digest("hex")
        .slice(0, 32)
    : null;

  await db.insert(auditLog).values({
    actorType: ctx.actor.type,
    actorId:
      ctx.actor.type === "user" ? ctx.actor.userId : ctx.actor.agentId,
    organizationId: ctx.organizationId,
    projectId: ctx.projectId ?? null,
    tool: input.tool ?? null,
    action: input.action,
    argsHash,
    result: input.result,
    errorCode: input.errorCode ?? null,
    durationMs: input.durationMs ?? null,
    approvalId: input.approvalId ?? null,
    runId: input.runId ?? null,
    metadata: {
      requestId: ctx.requestId,
      ...(input.metadata ?? {}),
    },
  });
}
