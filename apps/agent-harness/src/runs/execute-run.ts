import { jsonSchema, streamText, tool } from "ai";

import { createChatSessions } from "@acme/kv/chat-sessions";
import { loadAiresMcpTools } from "@acme/mcp-client";
import type { LoadedTools } from "@acme/mcp-client";
import { createLogger } from "@acme/observability";

import { mintAgentToken } from "../lib/agent-token";
import { pickProvider, resolveProvider } from "../lib/providers";
import type { ProviderId } from "../lib/providers";
import { upsertThreadIndex } from "./thread-index";
import { env } from "../env";

const logger = createLogger("agent-harness");

export interface ExecuteRunInput {
  runId: string;
  agentId: string;
  organizationId: string;
  threadId: string;
  message: string;
  sessionCookie?: string;
  apiKey?: string;
  providerOverride?: string | null;
  botDefaultProvider?: ProviderId | null;
}

export interface ExecuteRunDeps {
  mintToken?: typeof mintAgentToken;
  loadTools?: typeof loadAiresMcpTools;
  streamText?: typeof streamText;
  sessions?: ReturnType<typeof createChatSessions>;
  clock?: () => Date;
}

/**
 * Runs one turn of an agent conversation: mints a JWT, opens an MCP tool
 * session, streams a response from the chosen provider, and persists the
 * message pair to the thread buffer. Returns the AI SDK stream so the caller
 * (HTTP handler or test) decides how to consume it.
 */
export async function executeRun(
  input: ExecuteRunInput,
  deps: ExecuteRunDeps = {},
): Promise<{
  provider: ProviderId;
  stream: ReturnType<typeof streamText>;
  close: () => Promise<void>;
}> {
  const mint = deps.mintToken ?? mintAgentToken;
  const load = deps.loadTools ?? loadAiresMcpTools;
  const stream = deps.streamText ?? streamText;
  const sessions =
    deps.sessions ?? createChatSessions({ maxMessages: env.CHAT_THREAD_MAX_MESSAGES });
  const clock = deps.clock ?? (() => new Date());

  const overrideEnabled = env.FF_AGENT_MODEL_OVERRIDE === "true";
  const providerId = pickProvider({
    override: input.providerOverride ?? null,
    overrideEnabled,
    botDefault: input.botDefaultProvider ?? null,
    envDefault: env.AGENT_DEFAULT_MODEL,
  });

  const resolved = resolveProvider(providerId);

  const token = await mint({
    agentId: input.agentId,
    organizationId: input.organizationId,
    runId: input.runId,
    sessionCookie: input.sessionCookie,
    apiKey: input.apiKey,
  });

  const loaded: LoadedTools = await load({
    mcpUrl: env.MCP_SERVER_URL,
    agentJwt: token.token,
  });
  const { close } = loaded;
  const aiTools = adaptToAiSdkTools(loaded);

  await sessions.append(input.threadId, {
    role: "user",
    content: input.message,
    createdAt: clock().toISOString(),
  });

  // Best-effort: index the thread so the UI can list it. Failures here must
  // not break the run — the transient Redis history remains authoritative.
  void upsertThreadIndex({
    threadId: input.threadId,
    firstMessage: input.message,
    organizationId: input.organizationId,
    sessionCookie: input.sessionCookie,
    apiKey: input.apiKey,
  }).catch((err: unknown) => {
    logger.warn(
      {
        runId: input.runId,
        threadId: input.threadId,
        err: err instanceof Error ? err.message : String(err),
      },
      "agent-harness.thread-index.failed",
    );
  });

  const history = await sessions.read(input.threadId);

  logger.info(
    {
      runId: input.runId,
      agentId: input.agentId,
      provider: resolved.provider,
      toolCount: Object.keys(aiTools).length,
      scopeCount: token.scopes.length,
    },
    "agent-harness.run.start",
  );

  const messages = history.map((m) => ({
    role: m.role,
    content: m.content,
  })) as Parameters<typeof stream>[0]["messages"];

  const result = stream({
    model: resolved.model as Parameters<typeof stream>[0]["model"],
    tools: aiTools as unknown as Parameters<typeof stream>[0]["tools"],
    messages: messages ?? [],
    onFinish: async ({ text }) => {
      try {
        await sessions.append(input.threadId, {
          role: "assistant",
          content: text,
          createdAt: clock().toISOString(),
        });
      } catch (err) {
        logger.error(
          { runId: input.runId, err: err instanceof Error ? err.message : String(err) },
          "agent-harness.persist.failed",
        );
      } finally {
        await close().catch(() => {
          // already-closed MCP sessions are safe to swallow
        });
      }
    },
  });

  return { provider: resolved.provider, stream: result, close };
}

/**
 * Translate the MCP-provided tool map into AI SDK v5 `tool()` definitions.
 * MCP exposes JSON Schema, which AI SDK v5 accepts via its `jsonSchema()`
 * helper on the `inputSchema` property.
 */
function adaptToAiSdkTools(loaded: LoadedTools): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(loaded.tools)) {
    out[name] = tool({
      description: def.description,
      inputSchema: jsonSchema(def.parameters as Parameters<typeof jsonSchema>[0]),
      execute: (args: unknown) =>
        def.execute((args ?? {}) as Record<string, unknown>),
    } as unknown as Parameters<typeof tool>[0]);
  }
  return out;
}
