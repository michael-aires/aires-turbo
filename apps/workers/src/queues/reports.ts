import { Worker } from "bullmq";

import { BlacklineAdapter } from "@acme/integrations";
import type { ReportExportRequest } from "@acme/integrations";
import { createLogger } from "@acme/observability";

import { connection } from "../connection.js";
import { env } from "../env.js";

const logger = createLogger("worker.reports");

export function startReportsWorker() {
  if (!env.BLACKLINE_API_TOKEN) {
    logger.warn({
      reason: "BLACKLINE_API_TOKEN missing",
    }, "reports.worker.disabled");
    return undefined;
  }
  const adapter = new BlacklineAdapter({ apiToken: env.BLACKLINE_API_TOKEN });

  return new Worker<ReportExportRequest>(
    "reports",
    async (job) => {
      const result = await adapter.fetchReport(job.data);
      logger.info({ jobId: job.id, url: result.downloadUrl }, "report.fetched");
      return result;
    },
    { connection, concurrency: 2 },
  );
}
