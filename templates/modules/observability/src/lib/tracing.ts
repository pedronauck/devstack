import {
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  context,
  propagation,
  trace,
} from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { createMiddleware } from "hono/factory";
import { env } from "../../env";

let tracingSdk: NodeSDK | null = null;

export function initializeTracing() {
  if (!env.TRACING_ENABLED || tracingSdk) {
    return Promise.resolve(false);
  }

  tracingSdk = new NodeSDK({
    autoDetectResources: false,
    resource: resourceFromAttributes({
      "service.name": env.OTEL_SERVICE_NAME,
    }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
        })
      ),
    ],
    instrumentations: [new HttpInstrumentation()],
  });

  return tracingSdk.start().then(() => true);
}

export async function shutdownTracing() {
  if (!tracingSdk) {
    return;
  }

  const current = tracingSdk;
  tracingSdk = null;
  await current.shutdown();
}

export const tracingMiddleware = createMiddleware(async (c, next) => {
  const extractedContext = propagation.extract(ROOT_CONTEXT, c.req.raw.headers);
  const tracer = trace.getTracer("{{projectName}}-backend");
  const pathname = new URL(c.req.url).pathname;

  return tracer.startActiveSpan(
    `${c.req.method} ${pathname}`,
    { kind: SpanKind.SERVER },
    extractedContext,
    async span => {
      try {
        await next();
        span.setStatus({ code: c.res.status >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.OK });
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        propagation.inject(context.active(), c.res.headers);
        span.end();
      }
    }
  );
});

export type TracingVariables = Record<string, never>;
