import { kebabCase } from "es-toolkit/string";

const NOT_FOUND_SUFFIX = " not found";
const INTERNAL_ERROR_DETAIL = "Internal server error";

const STATUS_TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  429: "Too Many Requests",
  422: "Unprocessable Entity",
  500: "Internal Server Error",
  502: "Bad Gateway",
  504: "Gateway Timeout",
};

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = "Service unavailable") {
    super(message, 503, "SERVICE_UNAVAILABLE");
    this.name = "ServiceUnavailableError";
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message, 422, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

interface IntegrationErrorOptions {
  cause?: unknown;
  originalError?: unknown;
  code?: string;
  retryable?: boolean;
  statusCode?: number;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: ValidationErrorDetail[];
  provider?: string;
}

export class IntegrationError extends AppError {
  public readonly originalError?: unknown;
  public readonly retryable: boolean;

  constructor(
    message: string,
    public readonly provider: string,
    options: IntegrationErrorOptions = {}
  ) {
    super(message, options.statusCode ?? 502, options.code ?? "INTEGRATION_ERROR");
    this.name = "IntegrationError";
    this.originalError = options.originalError ?? options.cause;
    this.retryable = options.retryable ?? false;
  }
}

export class IntegrationTimeoutError extends IntegrationError {
  constructor(
    provider: string,
    public readonly timeoutMs: number,
    options: Omit<IntegrationErrorOptions, "code" | "retryable" | "statusCode"> = {}
  ) {
    super(`Request timed out after ${timeoutMs}ms`, provider, {
      ...options,
      code: "INTEGRATION_TIMEOUT",
      retryable: true,
      statusCode: 504,
    });
    this.name = "IntegrationTimeoutError";
  }
}

export class IntegrationRateLimitError extends IntegrationError {
  constructor(
    provider: string,
    public readonly retryAfterMs?: number,
    options: Omit<IntegrationErrorOptions, "code" | "retryable" | "statusCode"> = {}
  ) {
    super("Rate limit exceeded", provider, {
      ...options,
      code: "INTEGRATION_RATE_LIMIT",
      retryable: true,
      statusCode: 429,
    });
    this.name = "IntegrationRateLimitError";
  }
}

function isValidationErrorDetails(details: unknown): details is ValidationErrorDetail[] {
  if (!Array.isArray(details)) {
    return false;
  }

  return details.every(
    detail =>
      typeof detail === "object" &&
      detail !== null &&
      "field" in detail &&
      typeof detail.field === "string" &&
      "message" in detail &&
      typeof detail.message === "string"
  );
}

function getProblemTitle(statusCode: number): string {
  return STATUS_TITLES[statusCode] ?? "Internal Server Error";
}

function getProblemDetail(error: AppError): string {
  if (error instanceof NotFoundError && error.message.toLowerCase().endsWith(NOT_FOUND_SUFFIX)) {
    return error.message.slice(0, -NOT_FOUND_SUFFIX.length);
  }

  return error.message || INTERNAL_ERROR_DETAIL;
}

export function formatProblemDetails(error: AppError, instance: string): ProblemDetails {
  const problemDetails: ProblemDetails = {
    type: kebabCase(error.name),
    title: getProblemTitle(error.statusCode),
    status: error.statusCode,
    detail: getProblemDetail(error),
    instance,
  };

  if (
    (error instanceof ValidationError || error instanceof UnprocessableEntityError) &&
    isValidationErrorDetails(error.details)
  ) {
    problemDetails.errors = error.details;
  }

  if (error instanceof IntegrationError) {
    problemDetails.provider = error.provider;
  }

  return problemDetails;
}
