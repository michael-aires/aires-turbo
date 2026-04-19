import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

/**
 * Start OpenTelemetry with sane defaults. Enabled only when `OTEL_ENABLED=1`
 * so local dev stays quiet; Railway injects an OTLP endpoint in production.
 */
export function startTelemetry(serviceName: string, version = "0.0.0") {
  if (process.env.OTEL_ENABLED !== "1") return;

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: version,
    }),
    traceExporter: new OTLPTraceExporter({
      url:
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
        "http://localhost:4318/v1/traces",
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();

  const shutdown = () =>
    sdk
      .shutdown()
      .catch((err) => console.error("otel shutdown failed", err))
      .finally(() => process.exit(0));

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
