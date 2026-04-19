import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./root";

/**
 * Inference helpers for tRPC input types.
 * @example
 * type CreateContactInput = RouterInputs["contact"]["create"]
 */
type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helpers for tRPC output types.
 * @example
 * type ListContactsOutput = RouterOutputs["contact"]["list"]
 */
type RouterOutputs = inferRouterOutputs<AppRouter>;

export { type AppRouter, appRouter } from "./root";
export { createTRPCContext } from "./trpc";
export type { RouterInputs, RouterOutputs };
