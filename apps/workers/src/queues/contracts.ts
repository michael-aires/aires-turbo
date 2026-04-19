import { Worker } from "bullmq";

import { DocuSealAdapter } from "@acme/integrations";
import type { ContractSignRequest } from "@acme/integrations";
import { createLogger } from "@acme/observability";

import { connection } from "../connection.js";
import { env } from "../env.js";

const logger = createLogger("worker.contracts");

export function startContractsWorker() {
  if (!env.DOCUSEAL_API_KEY) {
    logger.warn({
      reason: "DOCUSEAL_API_KEY missing",
    }, "contracts.worker.disabled");
    return undefined;
  }
  const adapter = new DocuSealAdapter({ apiKey: env.DOCUSEAL_API_KEY });

  return new Worker<ContractSignRequest>(
    "contracts",
    async (job) => {
      const result = await adapter.createSubmission(job.data);
      logger.info({
        jobId: job.id,
        submissionId: result.submissionId,
      }, "contract.submission");
      return result;
    },
    { connection, concurrency: 2 },
  );
}
