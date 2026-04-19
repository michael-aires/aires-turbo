import type { z } from "zod/v4";

import type { ActorContext } from "@acme/auth";

export interface ToolContext {
  actor: ActorContext;
  organizationId: string;
  projectId?: string;
  requestId: string;
}

export interface ToolDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
> {
  name: string;
  displayName: string;
  description: string;
  category: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  requiredScopes: string[];
  requiresApproval: boolean;
  costTier: "free" | "low" | "medium" | "high";
  handler: (params: {
    input: z.infer<TInput>;
    ctx: ToolContext;
  }) => Promise<z.infer<TOutput>>;
}

export function defineTool<
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny,
>(definition: ToolDefinition<TInput, TOutput>): ToolDefinition<TInput, TOutput> {
  return definition;
}
