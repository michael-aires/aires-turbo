import { Worker } from "bullmq";

import { AircallAdapter } from "@acme/integrations";
import { createLogger } from "@acme/observability";

import { connection } from "../connection";
import { env } from "../env";

const logger = createLogger("worker.sms");

interface SmsJob {
  to: string;
  body: string;
}

export function startSmsWorker() {
  if (!env.AIRCALL_API_ID || !env.AIRCALL_API_TOKEN) {
    logger.warn({ reason: "aircall creds missing" }, "sms.worker.disabled");
    return undefined;
  }
  const adapter = new AircallAdapter({
    apiId: env.AIRCALL_API_ID,
    apiToken: env.AIRCALL_API_TOKEN,
  });

  return new Worker<SmsJob>(
    "sms",
    async (job) => {
      await adapter.sendSms({ to: job.data.to, body: job.data.body });
      logger.info({ jobId: job.id }, "sms.sent");
    },
    { connection, concurrency: 4 },
  );
}
