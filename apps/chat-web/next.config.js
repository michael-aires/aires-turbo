import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

await jiti.import("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  transpilePackages: ["@acme/auth", "@acme/ui"],
  typescript: { ignoreBuildErrors: true },
};

export default config;
