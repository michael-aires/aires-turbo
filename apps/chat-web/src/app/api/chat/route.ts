import type { NextRequest } from "next/server";

import { env } from "~/env";
import { getSession } from "~/lib/auth";

export const runtime = "nodejs";

/**
 * Forwards chat messages to the agent harness. We keep the Better-Auth
 * session cookie on the edge and pass it along so the harness can mint an
 * agent JWT for this user. No tokens are ever returned to the browser.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("unauthenticated", { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as
    | { agentId?: string; threadId?: string; messages?: { content: string }[] }
    | null;

  const lastMessage = payload?.messages?.at(-1)?.content;
  if (!payload?.agentId || !payload.threadId || !lastMessage) {
    return new Response("invalid_request", { status: 400 });
  }

  const cookieHeader = req.headers.get("cookie") ?? "";

  const upstream = await fetch(`${env.HARNESS_INTERNAL_URL}/v1/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
      "x-organization-id": env.SINGLE_ORG_ID,
    },
    body: JSON.stringify({
      agentId: payload.agentId,
      threadId: payload.threadId,
      message: lastMessage,
    }),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "text/event-stream",
      "x-run-id": upstream.headers.get("x-run-id") ?? "",
      "x-agent-provider": upstream.headers.get("x-agent-provider") ?? "",
    },
  });
}
