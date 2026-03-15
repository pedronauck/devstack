import { createMiddleware } from "hono/factory";
import { getRedisClient } from "../lib/redis";

async function incrementWindow(key: string, windowMs: number) {
  const client = getRedisClient();
  const hits = await client.incr(key);

  if (hits === 1) {
    await client.pexpire(key, windowMs);
  }

  return hits;
}

function createLimiter(limit: number, windowMs: number, namespace: string) {
  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const key = `${namespace}:${ip}`;
    const hits = await incrementWindow(key, windowMs);

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(Math.max(limit - hits, 0)));

    if (hits > limit) {
      return c.json(
        {
          type: "rate-limit-exceeded",
          title: "Rate limit exceeded",
          status: 429,
          detail: "Too many requests",
          instance: new URL(c.req.url).pathname,
        },
        429
      );
    }

    await next();
  });
}

export const publicRateLimit = createLimiter(
  Number(process.env.RATE_LIMIT_PUBLIC_LIMIT ?? "60"),
  Number(process.env.RATE_LIMIT_WINDOW_MS ?? "60000"),
  "{{projectName}}:public"
);

export const authenticatedRateLimit = createLimiter(
  Number(process.env.RATE_LIMIT_AUTHENTICATED_LIMIT ?? "300"),
  Number(process.env.RATE_LIMIT_WINDOW_MS ?? "60000"),
  "{{projectName}}:authenticated"
);

export const webhookRateLimit = createLimiter(
  Number(process.env.RATE_LIMIT_WEBHOOK_LIMIT ?? "120"),
  Number(process.env.RATE_LIMIT_WINDOW_MS ?? "60000"),
  "{{projectName}}:webhook"
);
