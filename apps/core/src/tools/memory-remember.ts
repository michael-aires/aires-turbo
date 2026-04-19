import { z } from "zod/v4";

import { defineTool, toolRegistry } from "@acme/agents";
import { OpenAIEmbedProvider, recall, remember } from "@acme/rag";

import { env } from "../env.js";

const RememberInput = z.object({
  content: z.string().min(1).max(4000),
  namespace: z.string().max(128).optional(),
  projectId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const memoryRememberTool = defineTool({
  name: "memory.remember",
  displayName: "Remember a fact",
  description: "Save a chunk to per-agent vector memory for later recall.",
  category: "memory",
  inputSchema: RememberInput,
  outputSchema: z.object({ id: z.string() }),
  requiredScopes: ["memory:write"],
  requiresApproval: false,
  costTier: "low",
  async handler({ input, ctx }) {
    if (ctx.actor.type !== "agent") {
      throw new Error("memory.remember is only callable by agents");
    }
    const embedder = new OpenAIEmbedProvider({
      apiKey: env.OPENAI_API_KEY ?? "",
    });
    return remember(
      {
        agentId: ctx.actor.agentId,
        projectId: input.projectId,
        namespace: input.namespace,
        content: input.content,
        metadata: input.metadata,
      },
      embedder,
    );
  },
});

const RecallInput = z.object({
  query: z.string().min(1).max(2000),
  namespace: z.string().max(128).optional(),
  topK: z.number().int().min(1).max(20).default(5),
});

export const memoryRecallTool = defineTool({
  name: "memory.recall",
  displayName: "Recall related memories",
  description: "Fetch top-K related memories for the calling agent.",
  category: "memory",
  inputSchema: RecallInput,
  outputSchema: z.object({
    hits: z.array(
      z.object({
        id: z.string(),
        content: z.string(),
        score: z.number(),
      }),
    ),
  }),
  requiredScopes: ["memory:read"],
  requiresApproval: false,
  costTier: "free",
  async handler({ input, ctx }) {
    if (ctx.actor.type !== "agent") {
      throw new Error("memory.recall is only callable by agents");
    }
    const embedder = new OpenAIEmbedProvider({
      apiKey: env.OPENAI_API_KEY ?? "",
    });
    const hits = await recall({ agentId: ctx.actor.agentId, ...input }, embedder);
    return { hits };
  },
});

export function registerMemoryTools() {
  toolRegistry.register(memoryRememberTool);
  toolRegistry.register(memoryRecallTool);
}
