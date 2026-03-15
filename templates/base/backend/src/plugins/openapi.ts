import { apiReference } from "@scalar/hono-api-reference";
import { createOpenApiApp } from "../lib/openapi";

/**
 * OpenAPI documentation routes
 * - Serves Scalar API documentation at /docs
 */
export const openApiRoutes = createOpenApiApp();

// Serve Scalar API documentation
openApiRoutes.get(
  "/docs",
  apiReference({
    theme: "default",
    url: "/openapi.json",
  })
);
