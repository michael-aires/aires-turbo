import type { UIMessage } from "ai";

export interface PersistedMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: string;
}

/**
 * Convert the Redis ring-buffer shape stored by @acme/kv into AI SDK v5
 * `UIMessage`s. Only user/assistant messages survive the trip — system and
 * tool chatter is elided because we don't render it in the MVP client.
 *
 * Pure on purpose: no fetch, no headers, no server-only imports, so it can
 * be unit-tested without a full Next.js runtime.
 */
export function persistedToUIMessages(
  threadId: string,
  persisted: readonly PersistedMessage[],
): UIMessage[] {
  return persisted
    .filter(
      (m): m is PersistedMessage & { role: "user" | "assistant" } =>
        m.role === "user" || m.role === "assistant",
    )
    .map<UIMessage>((m, index) => ({
      id: `${threadId}-${index.toString()}`,
      role: m.role,
      parts: [{ type: "text", text: m.content }],
    }));
}
