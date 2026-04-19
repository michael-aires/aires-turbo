import { Redis as IORedis } from "ioredis";

import { env } from "./env.js";

export const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
