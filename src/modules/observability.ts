import type { ModuleDefinition } from "./types.ts";

export const observabilityModule: ModuleDefinition = {
  name: "observability",
  label: "Observability",
  hint: "OpenTelemetry tracing plus Sentry.",
  envVars: [
    { key: "SENTRY_DSN", value: "https://examplePublicKey@o0.ingest.sentry.io/0" },
    { key: "TRACING_ENABLED", value: "0" },
    { key: "OTEL_EXPORTER_OTLP_ENDPOINT", value: "http://localhost:4317" },
    { key: "OTEL_SERVICE_NAME", value: "{{projectName}}-backend" },
  ],
  backend: {
    dependencies: {
      "@opentelemetry/api": "^1.9.0",
      "@opentelemetry/core": "^2.6.0",
      "@opentelemetry/exporter-trace-otlp-grpc": "^0.213.0",
      "@opentelemetry/instrumentation-http": "^0.213.0",
      "@opentelemetry/resources": "^2.6.0",
      "@opentelemetry/sdk-node": "^0.213.0",
      "@opentelemetry/sdk-trace-base": "^2.6.0",
      "@sentry/bun": "^10.43.0",
    },
  },
  frontend: {
    dependencies: {
      "@sentry/react": "^10.43.0",
    },
  },
};
