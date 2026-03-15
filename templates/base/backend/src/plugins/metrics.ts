import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

const SERVICE_NAME = "{{projectName}}-backend";
const DEFAULT_HTTP_DURATION_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5];
const DEFAULT_PAYLOAD_SIZE_BUCKETS = [128, 512, 1024, 4096, 16384, 65536, 262144];

const metricsRegistry = new Registry();
metricsRegistry.setDefaultLabels({
  service: SERVICE_NAME,
});

let defaultMetricsEnabled = false;

function ensureDefaultMetrics(rawEnv: Record<string, string | undefined> = process.env) {
  if (defaultMetricsEnabled || rawEnv.NODE_ENV === "test") {
    return;
  }

  collectDefaultMetrics({
    prefix: "process_",
    register: metricsRegistry,
  });
  defaultMetricsEnabled = true;
}

ensureDefaultMetrics();

const httpRequestsTotal = new Counter({
  help: "Total number of HTTP requests handled by the backend.",
  labelNames: ["method", "path", "status_code"] as const,
  name: "http_requests_total",
  registers: [metricsRegistry],
});

const httpRequestDurationSeconds = new Histogram({
  buckets: DEFAULT_HTTP_DURATION_BUCKETS,
  help: "Duration of HTTP requests handled by the backend.",
  labelNames: ["method", "path"] as const,
  name: "http_request_duration_seconds",
  registers: [metricsRegistry],
});

const httpRequestSizeBytes = new Histogram({
  buckets: DEFAULT_PAYLOAD_SIZE_BUCKETS,
  help: "Approximate request body size in bytes.",
  labelNames: ["method", "path"] as const,
  name: "http_request_size_bytes",
  registers: [metricsRegistry],
});

const dbQueryDurationSeconds = new Histogram({
  buckets: DEFAULT_HTTP_DURATION_BUCKETS,
  help: "Duration of database query executions.",
  labelNames: ["operation", "status"] as const,
  name: "db_query_duration_seconds",
  registers: [metricsRegistry],
});

function normalizeMetricPath(path: string | undefined) {
  if (!path || path === "") {
    return "/";
  }

  return path;
}

function parseContentLength(headerValue: string | undefined) {
  if (!headerValue) {
    return 0;
  }

  const parsedValue = Number(headerValue);

  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
}

export const metricsMiddleware = createMiddleware(async (c, next) => {
  ensureDefaultMetrics();

  const requestStartedAt = performance.now();
  const method = c.req.method;
  const requestSize = parseContentLength(c.req.header("content-length"));
  let statusCode = 500;

  try {
    await next();
    statusCode = c.res.status;
  } catch (error) {
    statusCode = 500;
    throw error;
  } finally {
    const durationSeconds = (performance.now() - requestStartedAt) / 1000;
    const requestPath = normalizeMetricPath(c.req.routePath || c.req.path);

    httpRequestsTotal.inc({
      method,
      path: requestPath,
      status_code: String(statusCode),
    });
    httpRequestDurationSeconds.observe(
      {
        method,
        path: requestPath,
      },
      durationSeconds
    );
    httpRequestSizeBytes.observe(
      {
        method,
        path: requestPath,
      },
      requestSize
    );
  }
});

export const metricsRoutes = new Hono().get("/", async c => {
  c.header("Content-Type", metricsRegistry.contentType);
  return c.text(await metricsRegistry.metrics());
});

export async function trackDbQuery<T>(operation: string, callback: () => Promise<T>) {
  const startedAt = performance.now();

  try {
    const result = await callback();
    dbQueryDurationSeconds.observe(
      {
        operation,
        status: "success",
      },
      (performance.now() - startedAt) / 1000
    );
    return result;
  } catch (error) {
    dbQueryDurationSeconds.observe(
      {
        operation,
        status: "error",
      },
      (performance.now() - startedAt) / 1000
    );
    throw error;
  }
}

export function getMetricsRegistry() {
  return metricsRegistry;
}

export function resetMetricsForTests() {
  metricsRegistry.resetMetrics();
}
