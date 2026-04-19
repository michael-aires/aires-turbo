import type { Logger, LoggerOptions } from "pino";
import { pino } from "pino";

export interface LogContext {
  service: string;
  operation?: string;
  step?: string;
  actorType?: "user" | "agent" | "system";
  actorId?: string;
  organizationId?: string;
  projectId?: string;
  requestId?: string;
  durationMs?: number;
  [key: string]: unknown;
}

/**
 * Canonical logger factory. Every service must bootstrap with this so logs
 * share the same shape and required keys (service, requestId, operation,
 * durationMs). Matches the observability rule in pxp-server/.cursor/rules.
 */
export function createLogger(
  serviceName: string,
  options: Partial<LoggerOptions> = {},
): Logger {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: {
      service: serviceName,
      env: process.env.NODE_ENV ?? "development",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "*.password",
        "*.secret",
        "*.apiKey",
        "*.token",
      ],
      censor: "[REDACTED]",
    },
    ...options,
  });
}

export type { Logger } from "pino";
