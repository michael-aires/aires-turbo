/**
 * Shared adapter contract. Every integration exposes a small, narrow surface
 * matching a single concern — adapters are composed by the worker/core layer
 * behind DI (see pxp-server-standards §encapsulation).
 */
export interface IntegrationAdapter<TConfig = unknown> {
  readonly name: string;
  readonly config: TConfig;
}

export interface EmailMessage {
  to: string | string[];
  from?: string;
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: {
    filename: string;
    contentBase64: string;
    type?: string;
  }[];
}

export interface SmsMessage {
  to: string;
  from?: string;
  body: string;
}

export interface VoiceCall {
  to: string;
  from?: string;
  recordingEnabled?: boolean;
  metadata?: Record<string, string>;
}

export interface ContractSignRequest {
  templateId: string;
  submitters: {
    email: string;
    name?: string;
    role?: string;
    fields?: Record<string, string>;
  }[];
  metadata?: Record<string, string>;
}

export interface ReportExportRequest {
  projectId: string;
  reportType: string;
  dateRange: { from: string; to: string };
  format: "csv" | "xlsx" | "pdf";
}
