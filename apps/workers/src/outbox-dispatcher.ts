import { randomUUID } from "node:crypto";

import {
  broadcast,
  drainOutbox,
  fanOut,
  pushToStream,
  toEnvelope,
} from "@acme/events";
import { createLogger } from "@acme/observability";

const logger = createLogger("worker.outbox");

/**
 * Poll the outbox every second, push each event onto the Redis Stream +
 * pub/sub channel, then fan out to HTTP subscriptions. `drainOutbox` is
 * responsible for marking rows published / incrementing attempts.
 */
export function startOutboxDispatcher() {
  let stopped = false;
  const consumerId = `outbox-${randomUUID()}`;
  const stop = () => {
    stopped = true;
  };

  const loop = async () => {
    while (!stopped) {
      try {
        const { processed, failed } = await drainOutbox({
          consumerId,
          sink: async (rows) => {
            const failedIds: string[] = [];
            for (const row of rows) {
              try {
                const envelope = toEnvelope(row);
                await pushToStream(envelope);
                await broadcast(envelope);
                await fanOut(envelope);
              } catch (err) {
                logger.error({
                  id: row.id,
                  error: String(err),
                }, "outbox.sink.failed");
                failedIds.push(row.id);
              }
            }
            return { failedIds };
          },
        });
        if (processed || failed) {
          logger.info({ processed, failed }, "outbox.drained");
        }
      } catch (err) {
        logger.error({ error: String(err) }, "outbox.loop.error");
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  };

  void loop();
  return stop;
}
