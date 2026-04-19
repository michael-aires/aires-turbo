import { z } from "zod/v4";

import { env } from "../env";

const AgentTokenResponseSchema = z.object({
  token: z.string(),
  jti: z.string(),
  expiresAt: z.string(),
  scopes: z.array(z.string()),
});

export type AgentTokenResponse = z.infer<typeof AgentTokenResponseSchema>;

export interface MintAgentTokenInput {
  agentId: string;
  organizationId: string;
  runId: string;
  sessionCookie?: string;
  apiKey?: string;
}

/**
 * Asks apps/core to mint a short-lived agent JWT for this run. Auth to the
 * mint endpoint itself is either a user session cookie (from chat-web) or
 * an API key (from chat-bots). The returned JWT is what flows into the MCP
 * client, NOT the caller's cookie/API key.
 */
export async function mintAgentToken(
  input: MintAgentTokenInput,
  deps: { fetch?: typeof fetch } = {},
): Promise<AgentTokenResponse> {
  const fetchImpl = deps.fetch ?? fetch;
  if (!input.sessionCookie && !input.apiKey) {
    throw new Error("mintAgentToken requires a session cookie or API key");
  }

  const url = `${env.CORE_INTERNAL_URL}/v1/agents/${encodeURIComponent(
    input.agentId,
  )}/tokens`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-organization-id": input.organizationId,
  };
  if (input.sessionCookie) headers.cookie = input.sessionCookie;
  if (input.apiKey) headers["x-api-key"] = input.apiKey;

  const res = await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ runId: input.runId }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `agent token mint failed: ${res.status} ${res.statusText} ${detail}`,
    );
  }

  return AgentTokenResponseSchema.parse(await res.json());
}
