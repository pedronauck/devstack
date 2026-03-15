import {
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  context,
  propagation,
  trace,
  type TextMapGetter,
  type TextMapSetter,
  type Tracer,
} from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { createMiddleware } from "hono/factory";

const DEFAULT_EXPORTER_URL = "http://localhost:4317";
const DEFAULT_SERVICE_NAME = "{{projectName}}-backend";
const TRACER_NAME = "{{projectName}}-backend";

const headersGetter: TextMapGetter<Headers> = {
  get(carrier, key) {
    return carrier.get(key) ?? undefined;
  },
  keys(carrier) {
    return Array.from(carrier.keys());
  },
};

const headersSetter: TextMapSetter<Headers> = {
  set(carrier, key, value) {
    carrier.set(key, value);
  },
};

let tracingSdk: NodeSDK | null = null;

export type TracingVariables = Record<string, never>;

export function resolveTracingEnvironment(rawEnv: Record<string, string | undefined> = process.env) {
  return {
    enabled: rawEnv.TRACING_ENABLED === "1",
    environment: rawEnv.NODE_ENV ?? "development",
    exporterUrl: rawEnv.OTEL_EXPORTER_OTLP_ENDPOINT ?? DEFAULT_EXPORTER_URL,
    serviceName: rawEnv.OTEL_SERVICE_NAME ?? DEFAULT_SERVICE_NAME,
  };
}

export async function initializeTracing(rawEnv: Record<string, string | undefined> = process.env) {
  const configuration = resolveTracingEnvironment(rawEnv);

  if (!configuration.enabled || tracingSdk) {
    return false;
  }

  tracingSdk = new NodeSDK({
    autoDetectResources: false,
    instrumentations: [new HttpInstrumentation()],
    resource: resourceFromAttributes({
      "deployment.environment.name": configuration.environment,
      "service.name": configuration.serviceName,
    }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: configuration.exporterUrl,
        })
      ),
    ],
  });

  await tracingSdk.start();
  return true;
}

export async function shutdownTracing() {
  if (!tracingSdk) {
    return;
  }

  const sdk = tracingSdk;
  tracingSdk = null;
  await sdk.shutdown();
}

export function createTracingMiddleware(options: { tracer?: Pick<Tracer, "startActiveSpan"> } = {}) {
  return createMiddleware(async (c, next) => {
    const tracer = options.tracer ?? trace.getTracer(TRACER_NAME);
    const extractedContext = propagation.extract(ROOT_CONTEXT, c.req.raw.headers, headersGetter);
    const requestUrl = new URL(c.req.url);

    return tracer.startActiveSpan(
      `${c.req.method} ${requestUrl.pathname}`,
      {
        kind: SpanKind.SERVER,
      },
      extractedContext,
      async span => {
        try {
          await next();
          span.setAttribute("http.route", c.req.routePath || c.req.path);
          span.setAttribute("http.response.status_code", c.res.status);
          span.setStatus({
            code: c.res.status >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
          });
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          throw error;
        } finally {
          const activeSpanContext = trace.setSpan(context.active(), span);
          propagation.inject(activeSpanContext, c.res.headers, headersSetter);
          span.end();
        }
      }
    );
  });
}

export const tracingMiddleware = createTracingMiddleware();
