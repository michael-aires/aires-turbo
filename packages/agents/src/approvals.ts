import { and, eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { agentRun, approval } from "@acme/db/schema";
import { EventType, publish } from "@acme/events";

export interface RequestApprovalParams {
  agentRunId: string;
  organizationId: string;
  reason?: string;
  actor: { type: "agent"; id: string };
}

export async function requestApproval(
  params: RequestApprovalParams,
): Promise<{ approvalId: string }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(approval)
      .values({
        agentRunId: params.agentRunId,
        organizationId: params.organizationId,
        reason: params.reason,
      })
      .returning({ id: approval.id });
    if (!row) throw new Error("failed to create approval");

    await tx
      .update(agentRun)
      .set({ status: "waiting_approval" })
      .where(eq(agentRun.id, params.agentRunId));

    await publish(tx, {
      organizationId: params.organizationId,
      eventType: EventType.ApprovalRequested,
      aggregateType: "approval",
      aggregateId: row.id,
      payload: {
        approvalId: row.id,
        agentRunId: params.agentRunId,
      },
      actor: params.actor,
    });

    return { approvalId: row.id };
  });
}

export async function decideApproval(params: {
  approvalId: string;
  decidedBy: string;
  decision: "approved" | "rejected";
  reason?: string;
}): Promise<void> {
  await db
    .update(approval)
    .set({
      decision: params.decision,
      decidedBy: params.decidedBy,
      decidedAt: new Date(),
      reason: params.reason,
    })
    .where(
      and(eq(approval.id, params.approvalId), eq(approval.decision, "pending")),
    );
}
