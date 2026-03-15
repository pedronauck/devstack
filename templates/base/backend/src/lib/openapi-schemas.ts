import { z } from "@hono/zod-openapi";

export const validationErrorDetailSchema = z
  .object({
    field: z.string(),
    message: z.string(),
  })
  .openapi("ValidationErrorDetail");

export const problemDetailsSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string(),
    errors: z.array(validationErrorDetailSchema).optional(),
    provider: z.string().optional(),
  })
  .openapi("ProblemDetails");

export const paginationMetaSchema = z
  .object({
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  })
  .openapi("PaginationMeta");

export function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({
    data: schema,
  });
}

export function paginatedEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({
    data: z.array(schema),
    meta: paginationMetaSchema,
  });
}

export const commonErrorResponses = {
  400: {
    content: {
      "application/problem+json": {
        schema: problemDetailsSchema,
      },
    },
    description: "Bad request",
  },
  401: {
    content: {
      "application/problem+json": {
        schema: problemDetailsSchema,
      },
    },
    description: "Unauthorized",
  },
  403: {
    content: {
      "application/problem+json": {
        schema: problemDetailsSchema,
      },
    },
    description: "Forbidden",
  },
  404: {
    content: {
      "application/problem+json": {
        schema: problemDetailsSchema,
      },
    },
    description: "Resource not found",
  },
  409: {
    content: {
      "application/problem+json": {
        schema: problemDetailsSchema,
      },
    },
    description: "Conflict",
  },
  422: {
    content: {
      "application/problem+json": {
        schema: problemDetailsSchema,
      },
    },
    description: "Unprocessable entity",
  },
  429: {
    content: {
      "application/problem+json": {
        schema: problemDetailsSchema,
      },
    },
    description: "Too many requests",
  },
  500: {
    content: {
      "application/problem+json": {
        schema: problemDetailsSchema,
      },
    },
    description: "Internal server error",
  },
  502: {
    content: {
      "application/problem+json": {
        schema: problemDetailsSchema,
      },
    },
    description: "Bad gateway",
  },
  504: {
    content: {
      "application/problem+json": {
        schema: problemDetailsSchema,
      },
    },
    description: "Gateway timeout",
  },
} as const;
