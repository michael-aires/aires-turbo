import { redirect } from "next/navigation";

import { env } from "~/env";
import { getSession } from "~/lib/auth";
import { hydrateThreadMessages } from "~/lib/hydrate-thread";
import { ChatShell } from "../chat-shell";

interface ChatThreadPageProps {
  params: Promise<{ threadId: string }>;
}

export default async function ChatThreadPage({ params }: ChatThreadPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { threadId } = await params;
  const initialMessages = await hydrateThreadMessages(threadId);

  return (
    <ChatShell
      userEmail={session.user.email}
      agentId={env.DEFAULT_AGENT_ID}
      orgId={env.SINGLE_ORG_ID}
      threadId={threadId}
      initialMessages={initialMessages}
    />
  );
}
