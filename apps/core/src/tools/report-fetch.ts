import { Queue } from "bullmq";
import { Redis as IORedis } from "ioredis";
import { z } from "zod/v4";

import { defineTool, toolRegistry, writeAudit } from "@acme/agents";
import { ReportExportRequestSchema } from "@acme/integrations";

import { env } from "../env.js";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
const reportsQueue = new Queue("reports", { connection });

const Input = z.object({
  projectId: z.string().uuid().optional(),
  reportType: z.string().min(1),
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
  dateRange: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
});

export const reportFetchTool = defineTool({
  name: "report.fetch",
  displayName: "Fetch report",
  description: "Queue a Blackline report export job.",
  category: "reporting",
  inputSchema: Input,
  outputSchema: z.object({ jobId: z.string(), queued: z.literal(true) }),
  requiredScopes: ["report:fetch"],
  requiresApproval: false,
  costTier: "medium",
  async handler({ input, ctx }) {
    const projectId = input.projectId ?? ctx.projectId;
    if (!projectId) {
      throw new Error("projectId is required for report.fetch");
    }

    const jobInput = ReportExportRequestSchema.parse({
      projectId,
      reportType: input.reportType,
      dateRange: input.dateRange,
      format: input.format,
    });

    const job = await reportsQueue.add("fetch", jobInput);
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
