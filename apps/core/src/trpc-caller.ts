import type { Context } from "hono";

import { appRouter, createTRPCContext } from "@acme/api";

import { auth } from "./auth";
import type { CoreHonoEnv } from "./middleware/context";

/**
 * Build a tRPC caller bound to the same context the REST handlers see, so
 * every REST call is a thin wrapper over the canonical router.
 */
export async function appCaller(c: Context<CoreHonoEnv>) {
  const ctx = await createTRPCContext({
    headers: c.req.raw.headers,
    auth,
  });
  return appRouter.createCaller(ctx);
}
