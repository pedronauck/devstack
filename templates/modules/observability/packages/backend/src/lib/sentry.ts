import * as Sentry from "@sentry/bun";

let initialized = false;

function parseSampleRate(rawValue: string | undefined) {
  const parsed = Number(rawValue ?? "0.1");
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.1;
}

export function initializeSentry(rawEnv: Record<string, string | undefined> = process.env) {
  if (initialized || !rawEnv.SENTRY_DSN) {
    return false;
  }

  Sentry.init({
    dsn: rawEnv.SENTRY_DSN,
    enabled: true,
    environment: rawEnv.NODE_ENV ?? "development",
    release: rawEnv.SENTRY_RELEASE,
    tracesSampleRate: parseSampleRate(rawEnv.SENTRY_TRACES_SAMPLE_RATE),
  });

  initialized = true;
  return true;
}
