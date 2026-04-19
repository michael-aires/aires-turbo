import { sql } from "drizzle-orm";

import { db } from "@acme/db/client";

import type { EmbedProvider } from "./embed.js";

export interface HybridSearchInput {
  query: string;
  organizationId: string;
  projectId?: string;
  topK?: number;
  /** 0..1 — weight for vector score vs full-text score. Default 0.7. */
  vectorWeight?: number;
}

export interface HybridSearchHit {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  title: string;
}

/**
 * Hybrid (vector + BM25-ish full-text) search across kb_chunk. Uses
 * pgvector cosine distance and Postgres `ts_rank_cd` in a single query.
 *
 * Required migration (run once):
 *   CREATE INDEX kb_chunk_embedding_hnsw
 *     ON kb_chunk USING hnsw (embedding vector_cosine_ops);
 *   CREATE INDEX kb_chunk_tsv_idx
 *     ON kb_chunk USING gin (to_tsvector('english', content));
 */
export async function hybridSearch(
  input: HybridSearchInput,
  embedder: EmbedProvider,
): Promise<HybridSearchHit[]> {
  const topK = input.topK ?? 8;
  const vw = input.vectorWeight ?? 0.7;
  const tw = 1 - vw;

  const [embedding] = await embedder.embed([input.query]);
  if (!embedding) return [];

  const vec = `[${embedding.join(",")}]`;

  const rows = (await db.execute(sql`
    with scored as (
      select
        c.id              as chunk_id,
        c.document_id     as document_id,
        c.content         as content,
        d.title           as title,
        1 - (c.embedding <=> ${vec}::vector) as vec_score,
        coalesce(
          ts_rank_cd(to_tsvector('english', c.content),
                     plainto_tsquery('english', ${input.query})),
          0
        ) as ts_score
      from kb_chunk c
      join kb_document d on d.id = c.document_id
      where d.organization_id = ${input.organizationId}::uuid
        ${input.projectId ? sql`and d.project_id = ${input.projectId}::uuid` : sql``}
      order by c.embedding <=> ${vec}::vector
      limit ${topK * 4}
    )
    select
      chunk_id, document_id, content, title,
      (${vw}::numeric * vec_score + ${tw}::numeric * ts_score) as score
    from scored
    order by score desc
    limit ${topK};
  `)) as unknown as {
    chunk_id: string;
    document_id: string;
    content: string;
    title: string;
    score: number;
  }[];

  return rows.map((r) => ({
    chunkId: r.chunk_id,
    documentId: r.document_id,
    content: r.content,
    title: r.title,
    score: Number(r.score),
  }));
}
