import { z } from "zod/v4";

import { defineTool, toolRegistry } from "@acme/agents";
import { hybridSearch, OpenAIEmbedProvider } from "@acme/rag";

import { env } from "../env.js";

const Input = z.object({
  query: z.string().min(1).max(2000),
  projectId: z.string().uuid().optional(),
  topK: z.number().int().min(1).max(20).default(8),
});

const Output = z.object({
  hits: z.array(
    z.object({
      chunkId: z.string(),
      documentId: z.string(),
      title: z.string(),
      content: z.string(),
      score: z.number(),
    }),
  ),
});

export const kbSearchTool = defineTool({
  name: "kb.search",
  displayName: "Search knowledge base",
  description:
    "Hybrid vector + full-text search across project knowledge documents.",
  category: "memory",
  inputSchema: Input,
  outputSchema: Output,
  requiredScopes: ["kb:search"],
  requiresApproval: false,
  costTier: "low",
  async handler({ input, ctx }) {
    const embedder = new OpenAIEmbedProvider({
      apiKey: env.OPENAI_API_KEY ?? "",
    });
    const hits = await hybridSearch(
      {
        query: input.query,
        organizationId: ctx.organizationId,
        projectId: input.projectId ?? ctx.projectId,
        topK: input.topK,
      },
      embedder,
    );
    return { hits };
  },
});

export function registerKbSearchTool() {
  toolRegistry.register(kbSearchTool);
}
