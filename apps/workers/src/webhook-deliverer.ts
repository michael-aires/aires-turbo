import { randomUUID } from "node:crypto";

import { deliverNext } from "@acme/events";
import { createLogger } from "@acme/observability";

const logger = createLogger("worker.webhook");

/**
 * Lightweight polling deliverer. In production this scales horizontally by
 * adding more Railway replicas — Postgres row-level locking prevents double
 * delivery via `deliverNext` which claims a single row per iteration.
 */
export function startWebhookDeliverer() {
  let stopped = false;
  const consumerId = `webhook-${randomUUID()}`;
  const loop = async () => {
    while (!stopped) {
      try {
        const result = await deliverNext({ consumerId });
        if (!result) {
          await new Promise((resolve) => setTimeout(resolve, 2_000));
          continue;
        }
        logger.info({
          deliveryId: result.deliveryId,
          subscriptionId: result.subscriptionId,
          status: result.status,
          responseStatus: result.responseStatus,
        }, "webhook.delivered");
      } catch (err) {
        logger.error({ error: String(err) }, "webhook.loop.error");
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
    }
  };
  void loop();
  return () => {
    stopped = true;
  };
}
