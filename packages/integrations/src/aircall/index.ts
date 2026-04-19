import type {
  IntegrationAdapter,
  SmsMessage,
  VoiceCall,
} from "../types";

export interface AircallConfig {
  apiId: string;
  apiToken: string;
  numberId?: number;
}

export class AircallAdapter implements IntegrationAdapter<AircallConfig> {
  readonly name = "aircall";
  constructor(public readonly config: AircallConfig) {
    if (!config.apiId || !config.apiToken) {
      throw new Error("aircall: apiId and apiToken are required");
    }
  }

  async sendSms(message: SmsMessage): Promise<{ externalId: string }> {
    return this.post<{ id: number }>("/v3/sms/send", {
      number_id: this.config.numberId,
      to: message.to,
      body: message.body,
    }).then((r) => ({ externalId: String(r.id) }));
  }

  async createOutboundCall(call: VoiceCall): Promise<{ externalId: string }> {
    return this.post<{ id: number }>(
      `/v3/numbers/${this.config.numberId}/calls`,
      {
        to: call.to,
        from: call.from,
      },
    ).then((r) => ({ externalId: String(r.id) }));
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const credentials = Buffer.from(
      `${this.config.apiId}:${this.config.apiToken}`,
    ).toString("base64");
    const response = await fetch(`https://api.aircall.io${path}`, {
      method: "POST",
      headers: {
        authorization: `Basic ${credentials}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`aircall ${path} failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }
}
