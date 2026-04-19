import { z } from "zod/v4";

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

export const ContractSubmitterSchema = z.object({
  email: z.string().email(),
  name: z.string().max(256).optional(),
  role: z.string().max(64).optional(),
  fields: z.record(z.string(), z.string()).optional(),
});

export const ContractSignRequestSchema = z.object({
  templateId: z.string().min(1),
  submitters: z.array(ContractSubmitterSchema).min(1),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type ContractSignRequest = z.infer<typeof ContractSignRequestSchema>;

export const ReportDateRangeSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const ReportExportRequestSchema = z.object({
  projectId: z.string().uuid(),
  reportType: z.string().min(1),
  dateRange: ReportDateRangeSchema,
  format: z.enum(["csv", "xlsx", "pdf"]),
});

export type ReportExportRequest = z.infer<typeof ReportExportRequestSchema>;
