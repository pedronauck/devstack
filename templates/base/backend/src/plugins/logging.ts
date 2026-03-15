import { createMiddleware } from "hono/factory";
import { logger } from "../lib/logger";

/**
 * Logging middleware for HTTP requests
 * Emits structured request completion logs through LogTape.
 */
export const loggingMiddleware = createMiddleware(async (c, next) => {
  const startedAt = performance.now();

  await next();

  logger.info("HTTP request completed", {
    durationMs: Number((performance.now() - startedAt).toFixed(3)),
    method: c.req.method,
    path: c.req.routePath || c.req.path,
    requestId: c.get("requestId"),
    statusCode: c.res.status,
  });
});
