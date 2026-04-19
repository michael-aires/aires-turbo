export type ToolCallState = "running" | "ok" | "error";

/**
 * Derive a `ToolCallCardProps['state']` from an AI SDK v5 tool part's
 * `state` string. The SDK emits `input-streaming`, `input-available`,
 * `output-available`, and `output-error`; the first two both count as
 * "running" for our purposes.
 *
 * Kept pure so it can be unit-tested without a DOM.
 */
export function deriveToolCallState(state: unknown): ToolCallState {
  if (state === "output-available") return "ok";
  if (state === "output-error") return "error";
  return "running";
}
