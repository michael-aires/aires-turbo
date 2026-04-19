import { initAuth } from "@acme/auth";

import { env } from "./env";

export const auth = initAuth({
  baseUrl: env.CORE_PUBLIC_URL,
  productionUrl: env.CORE_PUBLIC_URL,
  secret: env.BETTER_AUTH_SECRET,
  discordClientId: env.AUTH_DISCORD_ID,
  discordClientSecret: env.AUTH_DISCORD_SECRET,
  googleClientId: env.AUTH_GOOGLE_ID,
  googleClientSecret: env.AUTH_GOOGLE_SECRET,
});
