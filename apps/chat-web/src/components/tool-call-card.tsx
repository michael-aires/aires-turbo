"use client";

import { useState } from "react";

import { cn } from "@acme/ui";

import type { ToolCallState } from "./tool-call-state";

export type { ToolCallState } from "./tool-call-state";

export interface ToolCallCardProps {
  toolName: string;
  state: ToolCallState;
  args?: unknown;
  result?: unknown;
  errorText?: string;
}

/**
 * Collapsible card summarising a tool invocation in the stream. Three
 * visual states: running (spinner + pulse), ok (result available), error
 * (error message + retry hint). Args/result JSON is hidden by default to
 * keep the chat scannable; expanding is one click.
 */
export function ToolCallCard({
  toolName,
  state,
  args,
  result,
  errorText,
}: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const pillCopy = state === "running" ? "Running…" : state === "ok" ? "Done" : "Error";

  return (
    <div
      data-testid="tool-call-card"
      data-state={state}
      className={cn(
        "border-border bg-muted/40 my-2 rounded-lg border px-3 py-2 text-xs",
        state === "error" && "border-destructive/40 bg-destructive/5",
      )}
    >
      <button
        type="button"
        onClick={() => {
          setExpanded((prev) => !prev);
        }}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
        aria-controls={`tool-call-${toolName}-body`}
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              state === "running" && "bg-amber-500 animate-pulse",
              state === "ok" && "bg-emerald-500",
              state === "error" && "bg-destructive",
            )}
          />
          <span className="font-mono font-medium">{toolName}</span>
          <span className="text-muted-foreground">· {pillCopy}</span>
        </span>
        <span aria-hidden className="text-muted-foreground">
          {expanded ? "▴" : "▾"}
        </span>
      </button>

      {expanded && (
        <div
          id={`tool-call-${toolName}-body`}
          className="mt-2 space-y-2 border-t pt-2"
        >
          {args !== undefined && (
            <ToolJsonBlock label="Arguments" value={args} />
          )}
          {state === "ok" && result !== undefined && (
            <ToolJsonBlock label="Result" value={result} />
          )}
          {state === "error" && errorText && (
            <p className="text-destructive font-medium">{errorText}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ToolJsonBlock({ label, value }: { label: string; value: unknown }) {
  let serialised: string;
  try {
    serialised = JSON.stringify(value, null, 2);
  } catch {
    serialised = String(value);
  }
  return (
    <div>
      <div className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">
        {label}
      </div>
      <pre className="bg-background overflow-x-auto rounded border p-2 text-[11px]">
        {serialised}
      </pre>
    </div>
  );
}
