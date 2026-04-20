import type { EmailMessage, IntegrationAdapter } from "../types";

export interface ResendConfig {
  apiKey: string;
  defaultFrom?: string;
}

export interface ResendSendResult {
  messageId: string;
  status: number;
}

/**
 * Thin Resend HTTP client. We deliberately avoid the `resend` SDK because
 * BullMQ workers run in the same node container as several other adapters;
 * keeping transport dependencies flat makes boot time and container size
 * predictable. The REST surface is minimal — POST /emails with a bearer key.
 */
export class ResendAdapter implements IntegrationAdapter<ResendConfig> {
  readonly name = "resend";
  constructor(public readonly config: ResendConfig) {
    if (!config.apiKey) throw new Error("resend: apiKey is required");
  }

  async send(message: EmailMessage): Promise<ResendSendResult> {
    const from = message.from ?? this.config.defaultFrom;
    if (!from) throw new Error("resend: from address missing");
    if (!message.text && !message.html) {
      throw new Error("resend: message requires text or html content");
    }

    const body: Record<string, unknown> = {
      from,
      to: Array.isArray(message.to) ? message.to : [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
      cc: message.cc,
      bcc: message.bcc,
      reply_to: message.replyTo,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: a.contentBase64,
        content_type: a.type,
      })),
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.status >= 400) {
      const text = await response.text();
      throw new Error(`resend send failed: ${response.status} ${text}`);
    }

    const json = (await response.json()) as { id?: string };
    const messageId = json.id ?? `msg_${crypto.randomUUID()}`;

    return { messageId, status: response.status };
  }
}
