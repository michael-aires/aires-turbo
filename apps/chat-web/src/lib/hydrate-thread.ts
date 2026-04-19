import "server-only";

import { headers } from "next/headers";
import type { UIMessage } from "ai";

import { env } from "~/env";
import type { PersistedMessage } from "./persisted-to-ui-messages";
import { persistedToUIMessages } from "./persisted-to-ui-messages";

/**
 * Server-side history fetch used by the `/chat/[threadId]` route to seed
 * `useChat({ messages: initialMessages })`. We collapse ring-buffer entries
 * to minimal `UIMessage` shapes via the pure `persistedToUIMessages`
 * helper. Tool call parts are *not* persisted in the Redis buffer today,
 * so resumed threads lose tool-call cards — acceptable for Client A and
 * tracked for Client B via durable message storage.
 */
export async function hydrateThreadMessages(
  threadId: string,
): Promise<UIMessage[]> {
  const incomingHeaders = await headers();
  const cookie = incomingHeaders.get("cookie") ?? "";
  if (!cookie) return [];

  try {
    const res = await fetch(
      `${env.HARNESS_INTERNAL_URL}/v1/threads/${encodeURIComponent(threadId)}/messages`,
      {
        method: "GET",
        headers: {
          cookie,
          "x-organization-id": env.SINGLE_ORG_ID,
        },
        cache: "no-store",
      },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as
      | { messages?: PersistedMessage[] }
      | undefined;
    return persistedToUIMessages(threadId, body?.messages ?? []);
  } catch {
    return [];
  }
}
