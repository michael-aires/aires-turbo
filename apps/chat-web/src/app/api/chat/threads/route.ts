import type { NextRequest } from "next/server";

import { env } from "~/env";
import { getSession } from "~/lib/auth";

export const runtime = "nodejs";

/**
 * List the current user's recent chat threads. Thin proxy to core's
 * `/api/v1/chat-threads` — core owns the directory; Redis owns the bodies.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("unauthenticated", { status: 401 });
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const limit = req.nextUrl.searchParams.get("limit") ?? "20";

  const upstream = await fetch(
    `${env.CORE_INTERNAL_URL}/api/v1/chat-threads?limit=${encodeURIComponent(
      limit,
    )}`,
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
