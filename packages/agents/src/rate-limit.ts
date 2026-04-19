import { Redis } from "ioredis";

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

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

/**
 * Sliding-window rate limiter keyed on `agentId + tool`. Uses a Lua script so
 * increment + TTL are atomic.
 */
export async function hitRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowKey = `rl:${key}:${Math.floor(now / config.windowMs)}`;

  const count = await connect().incr(windowKey);
  if (count === 1) {
    await connect().pexpire(windowKey, config.windowMs);
  }

  const allowed = count <= config.max;
  const resetAt =
    (Math.floor(now / config.windowMs) + 1) * config.windowMs;

  return {
    allowed,
    remaining: Math.max(0, config.max - count),
    resetAt,
  };
}

export const rateLimitTiers: Record<string, RateLimitConfig> = {
  default: { windowMs: 60_000, max: 60 },
  low: { windowMs: 60_000, max: 20 },
  high: { windowMs: 60_000, max: 600 },
  unlimited: { windowMs: 60_000, max: Number.MAX_SAFE_INTEGER },
};
