import { mapValues } from "es-toolkit/object";
import { trim } from "es-toolkit/string";
import { z } from "zod";

const SECRET_KEY_PATTERN = /(SECRET|API_KEY|TOKEN|_KEY|PASSWORD)/i;

function normalizeOptionalValue(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    const normalized = trim(value);

    if (
      normalized === "" ||
      normalized.toLowerCase() === "undefined" ||
      normalized.toLowerCase() === "null"
    ) {
      return undefined;
    }

    return normalized;
  }

  return value;
}

const optionalString = z.preprocess(normalizeOptionalValue, z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().trim().min(1),
  DATABASE_URL_TEST: optionalString,
  APP_URL: z.string().url().default("http://localhost:3000"),
  CORS_ORIGIN: optionalString.default("http://localhost:5173"),
  LOG_FORMAT: z.enum(["json", "text"]).optional(),
  LOG_LEVEL: z.enum(["debug", "error", "info"]).optional(),
  // __MODULE_ENV_FIELDS__
});

function formatEnvError(error: z.ZodError) {
  return JSON.stringify(error.format(), null, 2);
}

export function loadEnv(rawEnv: Record<string, string | undefined> = process.env) {
  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    throw new Error(`Invalid environment variables:\n${formatEnvError(parsed.error)}`);
  }

  return parsed.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;

const hasString = (value: string | undefined) =>
  typeof value === "string" && trim(value).length > 0;

export const featureAvailability = {
  // __MODULE_FEATURES__
} as const;

export const redactedEnv = mapValues(env, (value, key) => {
  if (key === "DATABASE_URL" || key === "DATABASE_URL_TEST") {
    return "[REDACTED]";
  }

  return SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : value;
});

export const envHelpers = {
  hasString,
  optionalString,
};
