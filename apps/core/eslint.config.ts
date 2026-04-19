import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@acme/eslint-config/base";

export default defineConfig(
  {
    ignores: ["tests/**", "scripts/**"],
  },
  baseConfig,
  restrictEnvAccess,
);
