import { z } from "zod/v4";

import type { Redis } from "ioredis";

import { getKv } from "./index.js";

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
  toolName: z.string().optional(),
  toolCallId: z.string().optional(),
  createdAt: z.string(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

const DEFAULT_MAX_MESSAGES = 100;
const KEY_PREFIX = "chat:thread:";

function key(threadId: string): string {
  if (!threadId) throw new Error("threadId is required");
  return `${KEY_PREFIX}${threadId}`;
}

export interface ChatSessionsApi {
  append(threadId: string, message: ChatMessage): Promise<void>;
  read(threadId: string, limit?: number): Promise<ChatMessage[]>;
  clear(threadId: string): Promise<void>;
}

/**
 * Thin Redis-backed ring buffer for chat thread messages. Bounded length so
 * long threads don't grow unboundedly — older entries fall off the front.
 *
 * Bounded buffer via `LTRIM` keeps memory predictable and gives us a
 * natural spill-to-Postgres point at the audit layer.
 */
export function createChatSessions(
  options: { kv?: Redis; maxMessages?: number } = {},
): ChatSessionsApi {
  const kv = options.kv ?? getKv();
  const maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES;

  return {
    async append(threadId, message) {
      const parsed = ChatMessageSchema.parse(message);
      const k = key(threadId);
      await kv.rpush(k, JSON.stringify(parsed));
      await kv.ltrim(k, -maxMessages, -1);
    },

    async read(threadId, limit) {
      const k = key(threadId);
      const raw = await kv.lrange(k, -(limit ?? maxMessages), -1);
      return raw.map((entry) => ChatMessageSchema.parse(JSON.parse(entry)));
    },

    async clear(threadId) {
      await kv.del(key(threadId));
    },
  };
}
