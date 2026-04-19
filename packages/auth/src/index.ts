import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  admin,
  apiKey,
  jwt,
  oAuthProxy,
  organization,
} from "better-auth/plugins";

import { db } from "@acme/db/client";

export interface InitAuthOptions {
  baseUrl: string;
  productionUrl: string;
  secret: string | undefined;

  discordClientId?: string;
  discordClientSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;

  /**
   * Issuer URL for agent JWTs. Defaults to `${productionUrl}/api/auth`.
   * Used as the `iss` claim in minted agent tokens and exposed through JWKs.
   */
  jwtIssuer?: string;

  /**
   * Lifetime of agent JWTs (Better-Auth `jwt.expirationTime`). Agents should
   * refresh via their long-lived `apiKey`.
   */
  agentJwtTtl?: string;

  extraPlugins?: BetterAuthPlugin[];
}

/**
 * Initialise Better-Auth with the plugin stack shared by every Aires service:
 * - organization() for tenant scoping
 * - admin() for human admin surfaces
 * - apiKey() for long-lived machine credentials (agents, external CRMs)
 * - jwt()    for short-lived, scoped agent tokens validated by gateway JWKs
 * - oAuthProxy() + expo() for the existing admin/mobile surfaces
 */
export function initAuth(options: InitAuthOptions) {
  const socialProviders: BetterAuthOptions["socialProviders"] = {};
  if (options.discordClientId && options.discordClientSecret) {
    socialProviders.discord = {
      clientId: options.discordClientId,
      clientSecret: options.discordClientSecret,
      redirectURI: `${options.productionUrl}/api/auth/callback/discord`,
    };
  }
  if (options.googleClientId && options.googleClientSecret) {
    socialProviders.google = {
      clientId: options.googleClientId,
      clientSecret: options.googleClientSecret,
      redirectURI: `${options.productionUrl}/api/auth/callback/google`,
    };
  }

  // Better-Auth 1.4 beta exposes plugin factories whose nominal return types
  // reference slightly different internal `BetterAuthPlugin` declarations
  // across sub-packages. At runtime they compose fine; we cast the array to
  // the trunk type here so downstream consumers stay fully typed.
  const plugins = [
    organization(),
    admin(),
    apiKey({
      rateLimit: { enabled: true },
      enableMetadata: true,
    }),
    jwt({
      jwt: {
        issuer: options.jwtIssuer ?? `${options.productionUrl}/api/auth`,
        audience: "aires-crm",
        expirationTime: options.agentJwtTtl ?? "15m",
      },
      jwks: {
        keyPairConfig: { alg: "EdDSA", crv: "Ed25519" },
      },
    }),
    oAuthProxy({
      productionURL: options.productionUrl,
    }),
    expo(),
    ...(options.extraPlugins ?? []),
  ] as unknown as BetterAuthPlugin[];

  const config = {
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    baseURL: options.baseUrl,
    secret: options.secret,
    emailAndPassword: { enabled: true },
    plugins,
    socialProviders,
    trustedOrigins: ["expo://"],
    onAPIError: {
      onError(error, ctx) {
        // Pre-existing from the t3-turbo template. Better-Auth has no native
        // logger binding; keeping console here until a shim is wired.
        // eslint-disable-next-line no-console
        console.error("BETTER AUTH API ERROR", error, ctx);
      },
    },
  } satisfies BetterAuthOptions;

  return betterAuth(config);
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];

export type ActorContext =
  | { type: "user"; userId: string; sessionId: string; orgId?: string }
  | {
      type: "agent";
      agentId: string;
      tokenId: string;
      scopes: string[];
      projectIds: string[];
      orgId?: string;
    };
