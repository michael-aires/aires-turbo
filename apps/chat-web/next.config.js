import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

await jiti.import("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  // Every workspace package that chat-web pulls in (directly or
  // transitively) must be listed so Next/Turbopack applies the same
  // TS module resolution rules used at runtime by tsx.
  transpilePackages: [
    "@acme/auth",
    "@acme/db",
    "@acme/ui",
    "@acme/events",
    "@acme/api",
    "@acme/validators",
    "@acme/observability",
  ],
  typescript: { ignoreBuildErrors: true },
};

export default config;
