import { Queue } from "bullmq";
import { Redis as IORedis } from "ioredis";
import { z } from "zod/v4";

import { defineTool, requestApproval, toolRegistry, writeAudit } from "@acme/agents";
import { db } from "@acme/db/client";
import { agentRun } from "@acme/db/schema";

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
const contractQueue = new Queue("contracts", { connection });

const Input = z.object({
  templateId: z.string().min(1),
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().max(256).optional(),
        role: z.string().max(64).optional(),
      }),
    )
    .min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  contactId: z.string().uuid().optional(),
});

export const contractSendTool = defineTool({
  name: "contract.send",
  displayName: "Send contract for signature",
  description:
    "Queue a DocuSeal contract. High-impact — always requires human approval for agent callers.",
  category: "contracts",
  inputSchema: Input,
  outputSchema: z.object({
    jobId: z.string(),
    queued: z.boolean(),
    approvalId: z.string().optional(),
    agentRunId: z.string().optional(),
  }),
  requiredScopes: ["contracts:send"],
  requiresApproval: true,
  costTier: "high",
  async handler({ input, ctx }) {
    if (ctx.actor.type === "agent") {
      const [run] = await db
        .insert(agentRun)
        .values({
          agentId: ctx.actor.agentId,
          toolName: "contract.send",
          status: "waiting_approval",
          input,
        })
        .returning({ id: agentRun.id });
      if (!run) throw new Error("failed to open agent run");

      const { approvalId } = await requestApproval({
        agentRunId: run.id,
        organizationId: ctx.organizationId,
        reason: `Agent requested to send contract template ${input.templateId}`,
        actor: { type: "agent", id: ctx.actor.agentId },
      });
      await writeAudit(ctx, {
        tool: "contract.send",
        action: "contract.send.pending_approval",
        args: input,
        result: "ok",
        approvalId,
        runId: run.id,
      });
      return {
        jobId: "pending",
        queued: false,
        approvalId,
        agentRunId: run.id,
      };
    }

    const job = await contractQueue.add("create", input);
    await writeAudit(ctx, {
      tool: "contract.send",
      action: "contract.send",
      args: input,
      result: "ok",
      metadata: { jobId: job.id },
    });
    return { jobId: job.id ?? "unknown", queued: true };
  },
});

export function registerContractSendTool() {
  toolRegistry.register(contractSendTool);
}
