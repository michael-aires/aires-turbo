import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().default(4100),
    REDIS_URL: z.string().url(),
    CORE_INTERNAL_URL: z.string().url(),
    MCP_SERVER_URL: z.string().url(),
    SINGLE_ORG_ID: z.string().min(1),
    AGENT_DEFAULT_MODEL: z.enum(["claude", "gpt", "gemini"]).default("claude"),
    FF_AGENT_MODEL_OVERRIDE: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    CHAT_THREAD_MAX_MESSAGES: z.coerce.number().int().default(100),
    BETTER_AUTH_SECRET: z.string().min(16),
    LOG_LEVEL: z.string().default("info"),
  },
  runtimeEnv: process.env,
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
