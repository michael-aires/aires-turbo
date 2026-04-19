import { sql } from "drizzle-orm";

import { db } from "@acme/db/client";
import { agentMemory } from "@acme/db/schema";

import type { EmbedProvider } from "./embed.js";

export interface RememberInput {
  agentId: string;
  projectId?: string;
  namespace?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export async function remember(
  input: RememberInput,
  embedder: EmbedProvider,
): Promise<{ id: string }> {
  const [embedding] = await embedder.embed([input.content]);
  if (!embedding) throw new Error("embedder returned no vector");

  const [row] = await db
    .insert(agentMemory)
    .values({
      agentId: input.agentId,
      projectId: input.projectId ?? null,
      namespace: input.namespace ?? "default",
      content: input.content,
      embedding,
      metadata: input.metadata ?? {},
    })
    .returning({ id: agentMemory.id });

  if (!row) throw new Error("failed to insert memory");
  return { id: row.id };
}

export interface RecallInput {
  agentId: string;
  query: string;
  namespace?: string;
  topK?: number;
}

export async function recall(
  input: RecallInput,
  embedder: EmbedProvider,
): Promise<{ id: string; content: string; score: number }[]> {
  const topK = input.topK ?? 5;
  const [embedding] = await embedder.embed([input.query]);
  if (!embedding) return [];
  const vec = `[${embedding.join(",")}]`;

  const rows = (await db.execute(sql`
    select
      id, content,
      1 - (embedding <=> ${vec}::vector) as score
    from agent_memory
    where agent_id = ${input.agentId}::uuid
      and namespace = ${input.namespace ?? "default"}
    order by embedding <=> ${vec}::vector
    limit ${topK};
  `)) as unknown as { id: string; content: string; score: number }[];

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    score: Number(r.score),
  }));
}
