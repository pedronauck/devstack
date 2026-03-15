import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { trackDbQuery } from "../plugins/metrics";

const healthRoutes = new Hono();
const READINESS_TIMEOUT_MS = 5_000;

function withReadinessTimeout<T>(label: string, task: () => Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} readiness check timed out after ${READINESS_TIMEOUT_MS}ms`));
    }, READINESS_TIMEOUT_MS);

    timeoutId.unref?.();
  });

  return Promise.race([task(), timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

async function checkPostgresReadiness() {
  await withReadinessTimeout("postgres", async () => {
    await trackDbQuery("health_ready", async () => {
      await db.execute(sql`select 1`);
    });
  });
}

healthRoutes.get("/", c => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get("/ready", async c => {
  const timestamp = new Date().toISOString();
  const checks = {
    postgres: "ok",
  };

  try {
    await checkPostgresReadiness();
  } catch {
    checks.postgres = "error";
  }

  if (checks.postgres === "ok") {
    return c.json({
      status: "ready",
      checks,
      timestamp,
    });
  }

  return c.json(
    {
      status: "not_ready",
      checks,
      timestamp,
    },
    503
  );
});

export { healthRoutes };
