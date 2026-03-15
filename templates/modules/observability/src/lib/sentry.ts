import * as Sentry from "@sentry/bun";
import { env } from "../../env";

let isInitialized = false;

export function initializeSentry() {
  if (!env.SENTRY_DSN || isInitialized) {
    return false;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    enabled: true,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.1,
  });

  isInitialized = true;
  return true;
}
