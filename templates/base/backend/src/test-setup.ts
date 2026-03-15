import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { afterEach, vi } from "vitest";

config({
  path: fileURLToPath(new URL("../.env.test", import.meta.url)),
  override: false,
});

process.env.NODE_ENV = "test";
process.env.APP_URL ??= "http://localhost:3000";
process.env.CORS_ORIGIN ??= "http://localhost:5173";

function normalizeLocalPostgresUrl(value: string | undefined) {
  if (!value) {
    return value;
  }

  return value.replace("@localhost:", "@127.0.0.1:");
}

process.env.DATABASE_URL_TEST = normalizeLocalPostgresUrl(process.env.DATABASE_URL_TEST);
process.env.DATABASE_URL = normalizeLocalPostgresUrl(process.env.DATABASE_URL);

if (!process.env.DATABASE_URL_TEST && process.env.DATABASE_URL) {
  process.env.DATABASE_URL_TEST = process.env.DATABASE_URL;
}

if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
