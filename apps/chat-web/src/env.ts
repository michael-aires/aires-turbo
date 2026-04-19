import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod/v4";

import { authEnv } from "@acme/auth/env";

export const env = createEnv({
  extends: [authEnv()],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    HARNESS_INTERNAL_URL: z.string().url(),
    CORE_INTERNAL_URL: z.string().url(),
    SINGLE_ORG_ID: z.string().min(1),
    DEFAULT_AGENT_ID: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_APP_NAME: z.string().default("Aires Agent Chat"),
  },
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  },
  skipValidation:
    !!process.env.CI ||
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
