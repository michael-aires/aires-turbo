"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@acme/ui/button";
import { cn } from "@acme/ui";

interface ThreadRow {
  id: string;
  title: string;
  lastMessageAt: string;
}

export interface ThreadRailProps {
  activeThreadId: string;
}

/**
 * Thin left rail showing the 20 most recent threads. Clicking a row
 * hard-navigates so the dynamic route re-hydrates from `/api/chat/history`.
 * "New thread" generates a client-side UUID and routes there; the row in
 * Postgres gets created server-side on the first message.
 */
export function ThreadRail({ activeThreadId }: ThreadRailProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [threads, setThreads] = useState<ThreadRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/threads", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`thread list failed: ${res.status.toString()}`);
      }
      const data = (await res.json()) as { threads: ThreadRow[] };
      setThreads(data.threads);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load threads");
    }
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads, pathname]);

  const startNewThread = useCallback(() => {
    const next = `th_${crypto.randomUUID()}`;
    router.push(`/chat/${next}`);
  }, [router]);

  return (
    <aside className="bg-card w-64 shrink-0 border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-xs font-semibold tracking-wide uppercase">Threads</h2>
        <Button size="sm" variant="outline" onClick={startNewThread}>
          New
        </Button>
      </div>
      <nav
        className="h-[calc(100vh-3rem)] space-y-1 overflow-y-auto p-2"
        aria-label="Recent threads"
      >
        {error && (
          <p role="alert" className="text-destructive px-2 py-1 text-xs">
            {error}
          </p>
        )}
        {threads === null && !error && (
          <p className="text-muted-foreground px-2 py-1 text-xs">Loading…</p>
        )}
        {threads?.length === 0 && (
          <p className="text-muted-foreground px-2 py-1 text-xs">
            No threads yet. Click “New”.
          </p>
        )}
        {threads?.map((thread) => (
          <Link
            key={thread.id}
            href={`/chat/${thread.id}`}
            className={cn(
              "hover:bg-muted block truncate rounded-md px-2 py-1.5 text-sm",
              thread.id === activeThreadId && "bg-muted font-medium",
            )}
          >
            {thread.title}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
