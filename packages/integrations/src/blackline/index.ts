import type {
  IntegrationAdapter,
  ReportExportRequest,
} from "../types.js";

export interface BlacklineConfig {
  apiToken: string;
  projectToken?: string;
  baseUrl?: string;
}

export class BlacklineAdapter implements IntegrationAdapter<BlacklineConfig> {
  readonly name = "blackline";
  readonly baseUrl: string;
  constructor(public readonly config: BlacklineConfig) {
    if (!config.apiToken) throw new Error("blackline: apiToken is required");
    this.baseUrl = config.baseUrl ?? "https://api.blackline.com";
  }

  async fetchReport(
    request: ReportExportRequest,
  ): Promise<{ downloadUrl: string }> {
    const params = new URLSearchParams({
      report: request.reportType,
      from: request.dateRange.from,
      to: request.dateRange.to,
      format: request.format,
    });
    const response = await fetch(
      `${this.baseUrl}/projects/${request.projectId}/reports?${params.toString()}`,
      {
        headers: {
          authorization: `Bearer ${this.config.apiToken}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`blackline report failed: ${response.status}`);
    }
    const payload = (await response.json()) as { url: string };
    return { downloadUrl: payload.url };
  }
}
