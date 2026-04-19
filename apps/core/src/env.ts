import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().default(4000),
    POSTGRES_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(16),
    CORE_PUBLIC_URL: z.string().url(),
    CORE_INTERNAL_URL: z.string().url().optional(),
    CORS_ALLOWED_ORIGINS: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    AUTH_DISCORD_ID: z.string().optional(),
    AUTH_DISCORD_SECRET: z.string().optional(),
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    LOG_LEVEL: z.string().default("info"),
    OTEL_ENABLED: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    CHAT_BOTS_INTERNAL_URL: z.string().url().optional(),
    BOT_INTERNAL_SECRET: z.string().min(16).optional(),
    SINGLE_ORG_ID: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
