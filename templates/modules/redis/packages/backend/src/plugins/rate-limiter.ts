import { RedisStore } from "@hono-rate-limiter/redis";
import type { Context } from "hono";
import { MemoryStore, rateLimiter, type RateLimitInfo } from "hono-rate-limiter";
import { createRedisRateLimitClient, hasBunRedisClient } from "@/lib/redis";

export type RateLimitVariables = {
  rateLimit: RateLimitInfo | undefined;
};

function getStore(rawEnv: Record<string, string | undefined> = process.env) {
  if (hasBunRedisClient()) {
    return new RedisStore({
      client: createRedisRateLimitClient(rawEnv),
      prefix: "{{projectName}}:rate-limit:",
    });
  }

  return new MemoryStore();
}

function getClientIp(c: Context) {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? "unknown-ip";
}

function createLimiter(limit: number, keyGenerator: (c: Context) => string) {
  return rateLimiter({
    keyGenerator,
    limit,
    standardHeaders: "draft-6",
    store: getStore(),
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? "60000"),
  });
}

export const publicRateLimit = createLimiter(
  Number(process.env.RATE_LIMIT_PUBLIC_LIMIT ?? "30"),
  c => getClientIp(c)
);

export const webhookRateLimit = createLimiter(
  Number(process.env.RATE_LIMIT_WEBHOOK_LIMIT ?? "120"),
  c => c.req.path
);

export const authenticatedRateLimit = createLimiter(
  Number(process.env.RATE_LIMIT_AUTHENTICATED_LIMIT ?? "300"),
  c => {
    const user = (c as Context<{ Variables: { user?: { id?: string } } }>).get("user");
    return user?.id ?? getClientIp(c);
  }
);
