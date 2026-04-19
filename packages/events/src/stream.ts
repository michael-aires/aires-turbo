import { Redis } from "ioredis";

import type { EventEnvelope } from "./schemas.js";

const STREAM_KEY = "aires:events";

let redis: Redis | undefined;

function connect(): Redis {
  if (redis) return redis;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not configured");
  redis = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  return redis;
}

/** Push an event envelope onto the Redis Stream. */
export async function pushToStream(envelope: EventEnvelope): Promise<string> {
  const id = await connect().xadd(
    STREAM_KEY,
    "MAXLEN",
    "~",
    "100000",
    "*",
    "envelope",
    JSON.stringify(envelope),
  );
  if (!id) throw new Error("xadd returned null");
  return id;
}

export interface StreamConsumerOptions {
  group: string;
  consumer: string;
  blockMs?: number;
  batchSize?: number;
}

/**
 * Basic consumer loop. Callers pass a handler; we ack on success and leave
 * pending on failure so Redis' XPENDING can surface retries.
 */
export async function consumeStream(
  options: StreamConsumerOptions,
  handler: (envelope: EventEnvelope, id: string) => Promise<void>,
  shouldStop: () => boolean = () => false,
): Promise<void> {
  const r = connect();
  await ensureGroup(r, options.group);

  while (!shouldStop()) {
    const result = (await r.xreadgroup(
      "GROUP",
      options.group,
      options.consumer,
      "COUNT",
      options.batchSize ?? 32,
      "BLOCK",
      options.blockMs ?? 5_000,
      "STREAMS",
      STREAM_KEY,
      ">",
    )) as [string, [string, string[]][]][] | null;

    if (!result) continue;

    for (const [, entries] of result) {
      for (const [id, fields] of entries) {
        const idx = fields.indexOf("envelope");
        if (idx === -1 || idx + 1 >= fields.length) continue;
        try {
          const envelope = JSON.parse(fields[idx + 1]!) as EventEnvelope;
          await handler(envelope, id);
          await r.xack(STREAM_KEY, options.group, id);
        } catch (error) {
          console.error(`stream handler failed for ${id}`, error);
        }
      }
    }
  }
}

async function ensureGroup(r: Redis, group: string): Promise<void> {
  try {
    await r.xgroup("CREATE", STREAM_KEY, group, "$", "MKSTREAM");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) {
      throw error;
    }
  }
}

/**
 * Pub/sub-style broadcast for SSE. Uses a plain Redis channel alongside the
 * durable stream — SSE clients don't need replay, they need low-latency fan
 * out.
 */
export async function broadcast(envelope: EventEnvelope): Promise<void> {
  await connect().publish("aires:events:broadcast", JSON.stringify(envelope));
}

export function subscribeBroadcast(
  handler: (envelope: EventEnvelope) => void,
): () => void {
  const sub = new Redis(process.env.REDIS_URL!);
  void sub.subscribe("aires:events:broadcast");
  sub.on("message", (_channel: string, message: string) => {
    try {
      handler(JSON.parse(message) as EventEnvelope);
    } catch (error) {
      console.error("broadcast parse failed", error);
    }
  });
  return () => {
    void sub.quit();
  };
}
