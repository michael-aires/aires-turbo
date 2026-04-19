import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().default(4100),
    POSTGRES_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    SENDGRID_API_KEY: z.string().optional(),
    SENDGRID_FROM_EMAIL: z.string().email().optional(),
    AIRCALL_API_ID: z.string().optional(),
    AIRCALL_API_TOKEN: z.string().optional(),
    DOCUSEAL_API_KEY: z.string().optional(),
    BLACKLINE_API_TOKEN: z.string().optional(),
    LOG_LEVEL: z.string().default("info"),
    OTEL_ENABLED: z.string().optional(),
  },
  runtimeEnv: process.env,
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
