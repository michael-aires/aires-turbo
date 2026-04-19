import { redirect } from "next/navigation";

import { getSession } from "~/lib/auth";

/**
 * Bare `/chat` entry-point — always kicks the user into a fresh thread at
 * `/chat/<uuid>`. A redirect (not a rewrite) means the URL in the browser
 * matches the thread ID exactly so sharing/copy-paste work.
 */
export default async function ChatPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const threadId = `th_${crypto.randomUUID()}`;
  redirect(`/chat/${threadId}`);
}
