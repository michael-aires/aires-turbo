import { Redis } from "ioredis";

export type { Redis } from "ioredis";

let sharedClient: Redis | undefined;

/**
 * Shared ioredis client. One connection per process, reused by BullMQ,
 * rate limiting, outbox streams, and chat sessions so we don't churn
 * sockets.
 */
export function getKv(): Redis {
  if (sharedClient) return sharedClient;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not configured");
  sharedClient = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  return sharedClient;
}

/**
 * Test seam — inject a fake Redis implementation. Resets to default when
 * called with no argument.
 */
export function __setKvForTests(client: Redis | undefined): void {
  sharedClient = client;
}
