import { env } from "./env";

export interface CoreCatalogEntry {
  name: string;
  displayName: string;
  description: string;
  category: string;
  requiredScopes: string[];
  requiresApproval: boolean;
  costTier: string;
}

export async function fetchToolCatalog(): Promise<CoreCatalogEntry[]> {
  const response = await fetch(`${env.CORE_INTERNAL_URL}/api/v1/tools`);
  if (!response.ok) {
    throw new Error(`core tool catalog failed: ${response.status}`);
  }
  return response.json() as Promise<CoreCatalogEntry[]>;
}

export interface InvokeOptions {
  agentJwt: string;
  toolName: string;
  input: unknown;
  requestId: string;
}

export async function invokeTool(
  options: InvokeOptions,
): Promise<unknown> {
  const response = await fetch(
    `${env.CORE_INTERNAL_URL}/api/v1/tools/${encodeURIComponent(options.toolName)}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.agentJwt}`,
        "content-type": "application/json",
        "x-request-id": options.requestId,
      },
      body: JSON.stringify(options.input),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`core invoke failed: ${response.status} ${text}`);
  }
  return response.json();
}
