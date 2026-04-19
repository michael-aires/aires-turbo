export interface EmbedProvider {
  embed(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
}

export interface OpenAIEmbedConfig {
  apiKey: string;
  model?: string;
}

/**
 * OpenAI text-embedding-3-small by default (1536 dims, matches our schema).
 * Swap for another provider by implementing `EmbedProvider`.
 */
export class OpenAIEmbedProvider implements EmbedProvider {
  readonly dimensions = 1536;
  private readonly model: string;

  constructor(private readonly config: OpenAIEmbedConfig) {
    if (!config.apiKey) throw new Error("openai: apiKey is required");
    this.model = config.model ?? "text-embedding-3-small";
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!response.ok) {
      throw new Error(`openai embed failed: ${response.status}`);
    }
    const payload = (await response.json()) as {
      data: { embedding: number[] }[];
    };
    return payload.data.map((d) => d.embedding);
  }
}
