import { createLogger, startTelemetry } from "@acme/observability";

import { startHealthServer } from "./health.js";
import { startOutboxDispatcher } from "./outbox-dispatcher.js";
import { startContractsWorker } from "./queues/contracts.js";
import { startEmailWorker } from "./queues/email.js";
import { startReportsWorker } from "./queues/reports.js";
import { startSmsWorker } from "./queues/sms.js";
import { startWebhookDeliverer } from "./webhook-deliverer.js";

startTelemetry("aires-workers");
const logger = createLogger("aires-workers");

function main() {
  const health = startHealthServer();
  const stopOutbox = startOutboxDispatcher();
  const stopWebhook = startWebhookDeliverer();

  const workers = [
    startEmailWorker(),
    startSmsWorker(),
    startContractsWorker(),
    startReportsWorker(),
  ].filter((w): w is NonNullable<typeof w> => Boolean(w));

  const shutdown = async () => {
    logger.info({ operation: "workers.shutdown" }, "workers.shutdown");
    stopOutbox();
    stopWebhook();
    await Promise.all(workers.map((w) => w.close()));
    health.close(() => process.exit(0));
  };
  process.on("SIGTERM", () => {
    void shutdown();
  });
  process.on("SIGINT", () => {
    void shutdown();
  });
}

main();
