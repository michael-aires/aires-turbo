import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";

export type ProviderId = "claude" | "gpt" | "gemini";

export interface ResolvedModel {
  provider: ProviderId;
  // AI SDK LanguageModelV1 is unexported at the top level; typed as unknown
  // to keep the surface boundary narrow and stable across minor version bumps.
  model: unknown;
}

const registry: Record<ProviderId, () => unknown> = {
  claude: () => anthropic("claude-sonnet-4-5-20250929"),
  gpt: () => openai("gpt-4o"),
  gemini: () => google("gemini-2.5-pro"),
};

export function resolveProvider(id: ProviderId): ResolvedModel {
  const factory = registry[id];
  return { provider: id, model: factory() };
}

export function isProviderId(value: unknown): value is ProviderId {
  return value === "claude" || value === "gpt" || value === "gemini";
}

/**
 * Selection precedence: override header (dev-only, flagged) → bot default
 * → env default → hard default "claude". Keeps provider swap deterministic
 * and audit-loggable.
 */
export function pickProvider(input: {
  override?: string | null;
  overrideEnabled: boolean;
  botDefault?: ProviderId | null;
  envDefault: ProviderId;
}): ProviderId {
  if (input.overrideEnabled && input.override && isProviderId(input.override)) {
    return input.override;
  }
  if (input.botDefault) return input.botDefault;
  return input.envDefault;
}
