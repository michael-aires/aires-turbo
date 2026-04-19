import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().default(4200),
    REDIS_URL: z.string().url(),
    HARNESS_INTERNAL_URL: z.string().url(),
    CORE_INTERNAL_URL: z.string().url(),
    SINGLE_ORG_ID: z.string().min(1),
    BOT_AGENT_ID: z.string().min(1),
    BOT_API_KEY: z.string().min(16),
    BOT_INTERNAL_SECRET: z.string().min(16),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_WHATSAPP_FROM: z.string().optional(),
    LOG_LEVEL: z.string().default("info"),
  },
  runtimeEnv: process.env,
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
