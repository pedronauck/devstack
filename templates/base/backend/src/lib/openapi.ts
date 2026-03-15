import { OpenAPIHono, createRoute, type z } from "@hono/zod-openapi";
import type { Env } from "hono";
import { formatProblemDetails, UnprocessableEntityError } from "./errors";
import { commonErrorResponses } from "./openapi-schemas";

type OpenApiAppOptions<E extends Env> = ConstructorParameters<typeof OpenAPIHono<E>>[0];

export const bearerAuthSecurity = [{ BearerAuth: [] as string[] }];

export const validationHook = (result: any, c: any) => {
  if (result.success) {
    return undefined;
  }

  const details =
    result.error?.issues.map((issue: { message: string; path: PropertyKey[] }) => ({
      field: issue.path.join(".") || "unknown",
      message: issue.message,
    })) ?? [];
  const problem = formatProblemDetails(
    new UnprocessableEntityError("Validation failed", details),
    new URL(c.req.url).pathname
  );

  c.header("Content-Type", "application/problem+json");
  c.status(422);
  return c.body(JSON.stringify(problem));
};

export function createOpenApiApp<E extends Env>(options: OpenApiAppOptions<E> = {}) {
  const defaultHook = (options?.defaultHook ?? validationHook) as NonNullable<
    OpenApiAppOptions<E>
  >["defaultHook"];
  return new OpenAPIHono<E>({
    ...options,
    defaultHook,
  });
}

export const defineRoute = ((route: any) => createRoute(route)) as any;

export function jsonContent<T extends z.ZodTypeAny>(schema: T) {
  return {
    "application/json": {
      schema,
    },
  } as const;
}

export function problemContent<T extends z.ZodTypeAny>(schema: T) {
  return {
    "application/problem+json": {
      schema,
    },
  } as const;
}

export function jsonBody<T extends z.ZodTypeAny>(schema: T, description: string, required = true) {
  return {
    required,
    description,
    content: jsonContent(schema),
  } as const;
}

export function formBody<T extends z.ZodTypeAny>(
  schema: T,
  description: string,
  required = true,
  contentType: "multipart/form-data" | "application/x-www-form-urlencoded" = "multipart/form-data"
) {
  return {
    required,
    description,
    content: {
      [contentType]: {
        schema,
      },
    },
  } as const;
}

export function jsonResponse<T extends z.ZodTypeAny>(schema: T, description: string) {
  return {
    description,
    content: jsonContent(schema),
  } as const;
}

export function noContentResponse(description = "No content") {
  return {
    description,
  } as const;
}

export function getRequiredParam(
  c: {
    req: {
      param: (key: string) => string | undefined;
    };
  },
  key: string
) {
  const value = c.req.param(key);

  if (!value) {
    throw new Error(`Missing required route param: ${key}`);
  }

  return value;
}

export { commonErrorResponses };
