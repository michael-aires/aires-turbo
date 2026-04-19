import { env } from "../env";

export interface UpsertThreadIndexInput {
  threadId: string;
  firstMessage: string;
  organizationId: string;
  sessionCookie?: string;
  apiKey?: string;
}

/**
 * Upsert a row in core's `chat_thread` table so the thread appears in the
 * user's thread list. Title is derived from the first message (first 60
 * chars). Subsequent calls for the same thread only bump `last_message_at`
 * on the server side.
 *
 * Failures are non-fatal: the run should still succeed even if the thread
 * list is momentarily stale.
 */
export async function upsertThreadIndex(
  input: UpsertThreadIndexInput,
  deps: { fetch?: typeof fetch } = {},
): Promise<void> {
  const fetchImpl = deps.fetch ?? fetch;
  if (!input.sessionCookie && !input.apiKey) {
    return;
  }

  const title = deriveTitle(input.firstMessage);
  const url = `${env.CORE_INTERNAL_URL}/api/v1/chat-threads/${encodeURIComponent(
    input.threadId,
  )}`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-organization-id": input.organizationId,
  };
  if (input.sessionCookie) headers.cookie = input.sessionCookie;
  if (input.apiKey) headers["x-api-key"] = input.apiKey;

  const res = await fetchImpl(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    throw new Error(
      `chat-thread upsert failed: ${res.status.toString()} ${res.statusText}`,
    );
  }
}

export function deriveTitle(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 60) return trimmed || "New thread";
  return `${trimmed.slice(0, 57).trimEnd()}…`;
}
