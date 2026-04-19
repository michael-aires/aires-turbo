import type {
  ContractSignRequest,
  IntegrationAdapter,
} from "../types";

export interface DocuSealConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface DocuSealSubmissionResult {
  submissionId: string;
  signingLinks: { email: string; url: string }[];
}

export class DocuSealAdapter implements IntegrationAdapter<DocuSealConfig> {
  readonly name = "docuseal";
  readonly baseUrl: string;
  constructor(public readonly config: DocuSealConfig) {
    if (!config.apiKey) throw new Error("docuseal: apiKey is required");
    this.baseUrl = config.baseUrl ?? "https://api.docuseal.com";
  }

  async createSubmission(
    request: ContractSignRequest,
  ): Promise<DocuSealSubmissionResult> {
    const response = await fetch(`${this.baseUrl}/submissions`, {
      method: "POST",
      headers: {
        "X-Auth-Token": this.config.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        template_id: request.templateId,
        submitters: request.submitters.map((s) => ({
          email: s.email,
          name: s.name,
          role: s.role,
          values: s.fields,
        })),
        metadata: request.metadata,
      }),
    });
    if (!response.ok) {
      throw new Error(`docuseal submission failed: ${response.status}`);
    }
    const payload = (await response.json()) as {
      id: number;
      submitters: { email: string; embed_src: string }[];
    };
    return {
      submissionId: String(payload.id),
      signingLinks: payload.submitters.map((s) => ({
        email: s.email,
        url: s.embed_src,
      })),
    };
  }
}
