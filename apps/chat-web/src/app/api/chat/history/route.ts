import type { NextRequest } from "next/server";

import { env } from "~/env";
import { getSession } from "~/lib/auth";

export const runtime = "nodejs";

/**
 * Hydrate a thread's message history from the harness (which reads Redis).
 * We only trust this proxy to forward the session cookie; identity is still
 * resolved server-side in the harness via core's whoami.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("unauthenticated", { status: 401 });
  }

  const threadId = req.nextUrl.searchParams.get("threadId");
  if (!threadId) {
    return Response.json({ error: "threadId required" }, { status: 400 });
  }

  const cookieHeader = req.headers.get("cookie") ?? "";

  const upstream = await fetch(
    `${env.HARNESS_INTERNAL_URL}/v1/threads/${encodeURIComponent(threadId)}/messages`,
    {
      method: "GET",
      headers: {
        cookie: cookieHeader,
        "x-organization-id": env.SINGLE_ORG_ID,
      },
    },
  );

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
