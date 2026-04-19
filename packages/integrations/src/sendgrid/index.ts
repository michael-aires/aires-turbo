import type { EmailMessage, IntegrationAdapter } from "../types";

export interface SendGridConfig {
  apiKey: string;
  defaultFrom?: string;
}

export interface SendGridSendResult {
  messageId: string;
  status: number;
}

export class SendGridAdapter implements IntegrationAdapter<SendGridConfig> {
  readonly name = "sendgrid";
  constructor(public readonly config: SendGridConfig) {
    if (!config.apiKey) throw new Error("sendgrid: apiKey is required");
  }

  async send(message: EmailMessage): Promise<SendGridSendResult> {
    const from = message.from ?? this.config.defaultFrom;
    if (!from) throw new Error("sendgrid: from address missing");

    const toList = (Array.isArray(message.to) ? message.to : [message.to]).map(
      (email) => ({ email }),
    );

    const body: Record<string, unknown> = {
      from: { email: from },
      personalizations: [
        {
          to: toList,
          cc: message.cc?.map((email) => ({ email })),
          bcc: message.bcc?.map((email) => ({ email })),
          subject: message.subject,
          dynamic_template_data: message.dynamicTemplateData,
        },
      ],
      reply_to: message.replyTo ? { email: message.replyTo } : undefined,
      template_id: message.templateId,
      content: buildContent(message),
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: a.contentBase64,
        type: a.type,
      })),
    };

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.status >= 400) {
      const text = await response.text();
      throw new Error(`sendgrid send failed: ${response.status} ${text}`);
    }

    const messageId =
      response.headers.get("x-message-id") ?? cryptoRandomId();

    return { messageId, status: response.status };
  }
}

function buildContent(message: EmailMessage) {
  const content: { type: string; value: string }[] = [];
  if (message.text) content.push({ type: "text/plain", value: message.text });
  if (message.html) content.push({ type: "text/html", value: message.html });
  return content.length ? content : undefined;
}

function cryptoRandomId(): string {
  return `msg_${crypto.randomUUID()}`;
}
