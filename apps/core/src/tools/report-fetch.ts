import { Queue } from "bullmq";
import { Redis as IORedis } from "ioredis";
import { z } from "zod/v4";

import { defineTool, toolRegistry, writeAudit } from "@acme/agents";

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
const reportsQueue = new Queue("reports", { connection });

const Input = z.object({
  reportId: z.string(),
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
  rangeStart: z.string().datetime().optional(),
  rangeEnd: z.string().datetime().optional(),
});

export const reportFetchTool = defineTool({
  name: "report.fetch",
  displayName: "Fetch report",
  description: "Queue a Blackline report export job.",
  category: "reporting",
  inputSchema: Input,
  outputSchema: z.object({ jobId: z.string(), queued: z.literal(true) }),
  requiredScopes: ["reports:read"],
  requiresApproval: false,
  costTier: "medium",
  async handler({ input, ctx }) {
    const job = await reportsQueue.add("fetch", input);
    await writeAudit(ctx, {
      tool: "report.fetch",
      action: "report.fetch",
      args: input,
      result: "ok",
      metadata: { jobId: job.id },
    });
    return { jobId: job.id ?? "unknown", queued: true as const };
  },
});

export function registerReportFetchTool() {
  toolRegistry.register(reportFetchTool);
}
