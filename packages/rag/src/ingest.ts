import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { kbChunk, kbDocument } from "@acme/db/schema";

import { chunkText } from "./chunk.js";
import type { EmbedProvider } from "./embed.js";

export interface IngestInput {
  organizationId: string;
  projectId?: string;
  title: string;
  content: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestResult {
  documentId: string;
  chunkCount: number;
  deduplicated: boolean;
}

export async function ingestDocument(
  input: IngestInput,
  embedder: EmbedProvider,
): Promise<IngestResult> {
  const checksum = createHash("sha256")
    .update(input.content)
    .digest("hex");

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: kbDocument.id })
      .from(kbDocument)
      .where(
        and(
          eq(kbDocument.organizationId, input.organizationId),
          eq(kbDocument.checksum, checksum),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return {
        documentId: existing[0].id,
        chunkCount: 0,
        deduplicated: true,
      };
    }

    const [doc] = await tx
      .insert(kbDocument)
      .values({
        organizationId: input.organizationId,
        projectId: input.projectId ?? null,
        title: input.title,
        checksum,
        sourceUrl: input.sourceUrl ?? null,
        metadata: input.metadata ?? {},
      })
      .returning({ id: kbDocument.id });

    if (!doc) throw new Error("failed to insert kb_document");

    const chunks = chunkText(input.content);
    if (chunks.length === 0) {
      return { documentId: doc.id, chunkCount: 0, deduplicated: false };
    }

    const embeddings = await embedder.embed(chunks);

    await tx.insert(kbChunk).values(
      chunks.map((content: string, idx: number) => ({
        documentId: doc.id,
        chunkIndex: idx,
        content,
        embedding: embeddings[idx]!,
        tokens: Math.ceil(content.split(/\s+/).length * 1.3),
        metadata: input.metadata ?? {},
      })),
    );

    return {
      documentId: doc.id,
      chunkCount: chunks.length,
      deduplicated: false,
    };
  });
}
