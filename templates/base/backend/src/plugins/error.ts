import type { ErrorHandler } from "hono";
import { AppError, formatProblemDetails } from "../lib/errors";
import { logger } from "../lib/logger";

type StatusCode = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 502 | 503;

/**
 * Centralized error handler for Hono
 * - Catches all errors and returns consistent JSON responses
 * - Handles AppError subclasses with appropriate status codes
 * - Hides internal error details from clients
 */
export const errorHandler: ErrorHandler = (error, c) => {
  const instance = new URL(c.req.url).pathname;
  const statusCode = error instanceof AppError ? error.statusCode : 500;

  logger.error("HTTP request failed", {
    error,
    method: c.req.method,
    path: instance,
    requestId: c.get("requestId"),
    statusCode,
  });

  if (error instanceof AppError) {
    const appError = error;
    const problemDetails = formatProblemDetails(appError, instance);
    c.header("Content-Type", "application/problem+json");
    c.status(appError.statusCode as StatusCode);

    return c.body(JSON.stringify(problemDetails));
  }

  const internalError = new AppError("Internal server error", 500, "INTERNAL_ERROR");
  const problemDetails = formatProblemDetails(internalError, instance);
  c.header("Content-Type", "application/problem+json");
  c.status(500);

  return c.body(JSON.stringify(problemDetails));
};
