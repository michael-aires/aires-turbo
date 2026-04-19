"use client";

import type { FormEvent } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";

import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { cn } from "@acme/ui";

import { Markdown } from "~/components/markdown";
import { ToolCallCard } from "~/components/tool-call-card";
import { deriveToolCallState } from "~/components/tool-call-state";
import { ThreadRail } from "./thread-rail";

const SAMPLE_PROMPTS = [
  "Find the most recent Peterson contacts",
  "Pull last week's sales report",
  "Draft a follow-up email to today's no-shows",
];

interface ChatShellProps {
  userEmail: string;
  agentId: string;
  orgId: string;
  threadId: string;
  initialMessages: UIMessage[];
}

export function ChatShell({
  userEmail,
  agentId,
  orgId,
  threadId,
  initialMessages,
}: ChatShellProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  /**
   * Transport-based v5 API: we customise the request body so the harness
   * still sees `{ agentId, threadId, message }` without needing to teach it
   * about UIMessage shape. The message we send is always the latest user
   * part the SDK just appended; everything else is metadata.
   */
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, id }) => {
          const last = messages[messages.length - 1];
          const text =
            last?.parts.find((p) => p.type === "text")?.text ?? "";
          return {
            body: {
              agentId,
              threadId: id,
              messages: [{ content: text }],
            },
          };
        },
      }),
    [agentId],
  );

  const { messages, sendMessage, stop, regenerate, status, error, clearError } =
    useChat({
      id: threadId,
      messages: initialMessages,
      transport,
    });

  const isStreaming = status === "submitted" || status === "streaming";

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isStreaming) return;
      stickToBottomRef.current = true;
      clearError();
      void sendMessage({ text: trimmed });
      setInput("");
    },
    [clearError, input, isStreaming, sendMessage],
  );

  const handlePromptPick = useCallback(
    (prompt: string) => {
      if (isStreaming) return;
      stickToBottomRef.current = true;
      clearError();
      void sendMessage({ text: prompt });
    },
    [clearError, isStreaming, sendMessage],
  );

  /**
   * Auto-scroll only while the user hasn't deliberately scrolled up.
   * We treat being within 80px of the bottom as "stuck to bottom".
   */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 80;
  }, []);

  return (
    <div className="flex h-screen">
      <ThreadRail activeThreadId={threadId} />

      <div className="mx-auto flex h-screen max-w-3xl flex-1 flex-col p-4">
        <header className="flex items-center justify-between pb-4">
          <div>
            <h1 className="text-lg font-semibold">Aires Agent Chat</h1>
            <p className="text-muted-foreground text-xs">
              {userEmail} · org {orgId.slice(0, 8)}… · thread{" "}
              {threadId.slice(0, 10)}…
            </p>
          </div>
          <form action="/api/auth/sign-out" method="POST">
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </header>

        <section
          ref={scrollRef}
          onScroll={onScroll}
          aria-live="polite"
          className="bg-card flex-1 space-y-3 overflow-y-auto rounded-xl border p-4"
        >
          {messages.length === 0 && (
            <EmptyState onPick={handlePromptPick} disabled={isStreaming} />
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {status === "submitted" && messages.length > 0 && (
            <div
              aria-label="Assistant is thinking"
              className="text-muted-foreground mr-8 text-xs"
            >
              …
            </div>
          )}
        </section>

        {error && (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive mt-2 flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <span>{error.message}</span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  clearError();
                }}
              >
                Dismiss
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  clearError();
                  void regenerate();
                }}
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <Input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            placeholder="Message your agent…"
            aria-label="Chat input"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button type="button" variant="outline" onClick={stop}>
              Stop
            </Button>
          ) : (
            <>
              {messages.some((m) => m.role === "assistant") && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    void regenerate();
                  }}
                >
                  Regenerate
                </Button>
              )}
              <Button type="submit" disabled={!input.trim()}>
                Send
              </Button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  onPick: (prompt: string) => void;
  disabled: boolean;
}

function EmptyState({ onPick, disabled }: EmptyStateProps) {
  return (
    <div className="text-muted-foreground space-y-3 text-sm">
      <p>
        Ask your agent to search contacts, send a contract, or pull a report.
      </p>
      <div className="flex flex-wrap gap-2">
        {SAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => {
              onPick(prompt);
            }}
            disabled={disabled}
            className="hover:bg-muted border-border bg-background disabled:cursor-not-allowed rounded-full border px-3 py-1 text-xs disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: UIMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  return (
    <article
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        isUser ? "bg-primary/5 ml-8" : "bg-muted mr-8",
      )}
    >
      <div className="text-muted-foreground mb-1 text-xs font-medium uppercase">
        {message.role}
      </div>
      <div className="space-y-1">
        {message.parts.map((part, i) => (
          <MessagePart key={i} part={part} />
        ))}
      </div>
    </article>
  );
}

interface MessagePartProps {
  part: UIMessage["parts"][number];
}

/**
 * Map an AI SDK v5 UIMessage part to a React node. We handle three classes:
 *   - text parts → markdown renderer
 *   - `tool-*` parts → ToolCallCard with state derived from the part's state
 *   - anything else (step-start, dynamic-tool, reasoning) → noop for MVP
 */
function MessagePart({ part }: MessagePartProps) {
  if (part.type === "text") {
    return <Markdown>{part.text}</Markdown>;
  }

  // Tool parts in v5 are `tool-<toolName>` with states:
  //   input-streaming | input-available | output-available | output-error
  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    const toolName = part.type.slice("tool-".length);
    const p = part as unknown as {
      state?: string;
      input?: unknown;
      output?: unknown;
      errorText?: string;
    };
    return (
      <ToolCallCard
        toolName={toolName}
        state={deriveToolCallState(p.state)}
        args={p.input}
        result={p.output}
        errorText={p.errorText}
      />
    );
  }

  return null;
}
