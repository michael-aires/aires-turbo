/**
 * Chunking strategy: recursive split on paragraph then sentence boundaries,
 * with a hard max of ~800 tokens per chunk. Token count is approximated by
 * word count × 1.3 — cheap, good enough for a first cut.
 */
export interface ChunkOptions {
  maxTokens?: number;
  overlapTokens?: number;
}

export function chunkText(
  text: string,
  options: ChunkOptions = {},
): string[] {
  const maxTokens = options.maxTokens ?? 800;
  const overlapTokens = options.overlapTokens ?? 80;
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf: string[] = [];
  let bufTokens = 0;

  for (const paragraph of paragraphs) {
    const tokens = approxTokens(paragraph);
    if (tokens > maxTokens) {
      if (buf.length) chunks.push(buf.join("\n\n"));
      chunks.push(...splitLongParagraph(paragraph, maxTokens));
      buf = [];
      bufTokens = 0;
      continue;
    }
    if (bufTokens + tokens > maxTokens) {
      chunks.push(buf.join("\n\n"));
      buf = overlap(buf, overlapTokens);
      bufTokens = buf.reduce((n, p) => n + approxTokens(p), 0);
    }
    buf.push(paragraph);
    bufTokens += tokens;
  }
  if (buf.length) chunks.push(buf.join("\n\n"));
  return chunks;
}

function splitLongParagraph(paragraph: string, maxTokens: number): string[] {
  const sentences = paragraph.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let buf: string[] = [];
  let tokens = 0;
  for (const sentence of sentences) {
    const t = approxTokens(sentence);
    if (tokens + t > maxTokens && buf.length) {
      out.push(buf.join(" "));
      buf = [];
      tokens = 0;
    }
    buf.push(sentence);
    tokens += t;
  }
  if (buf.length) out.push(buf.join(" "));
  return out;
}

function overlap(prev: string[], overlapTokens: number): string[] {
  const tail: string[] = [];
  let tokens = 0;
  for (let i = prev.length - 1; i >= 0 && tokens < overlapTokens; i -= 1) {
    tail.unshift(prev[i]!);
    tokens += approxTokens(prev[i]!);
  }
  return tail;
}

function approxTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3);
}
