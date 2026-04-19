import { Queue } from "bullmq";
import { Redis as IORedis } from "ioredis";
import { z } from "zod/v4";

import { defineTool, toolRegistry, writeAudit } from "@acme/agents";

import { env } from "../env.js";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
const smsQueue = new Queue("sms", { connection });

const Input = z.object({
  to: z.string().min(6).max(32),
  body: z.string().min(1).max(1600),
  contactId: z.string().uuid().optional(),
});

export const smsSendTool = defineTool({
  name: "sms.send",
  displayName: "Send SMS",
  description: "Queue an outbound SMS via Aircall.",
  category: "communication",
  inputSchema: Input,
  outputSchema: z.object({ jobId: z.string(), queued: z.literal(true) }),
  requiredScopes: ["sms:send"],
  requiresApproval: false,
  costTier: "low",
  async handler({ input, ctx }) {
    const job = await smsQueue.add("send", input);
    await writeAudit(ctx, {
      tool: "sms.send",
      action: "sms.send",
      args: input,
      result: "ok",
      metadata: { jobId: job.id },
    });
    return { jobId: job.id ?? "unknown", queued: true as const };
  },
});

export function registerSmsSendTool() {
  toolRegistry.register(smsSendTool);
}
