import type { RedisClient as RateLimitRedisClient } from "@hono-rate-limiter/redis";

type BunRedisClient = import("bun").RedisClient;
type BunRedisConstructor = typeof import("bun").RedisClient;

let sharedClient: BunRedisClient | null = null;

function getRedisConstructor() {
  const bun = globalThis as typeof globalThis & {
    Bun?: {
      RedisClient?: BunRedisConstructor;
    };
  };

  return bun.Bun?.RedisClient;
}

export function hasBunRedisClient() {
  return typeof getRedisConstructor() === "function";
}

export function createRedisClient(rawEnv: Record<string, string | undefined> = process.env) {
  const RedisClient = getRedisConstructor();

  if (!RedisClient) {
    throw new Error("Bun RedisClient is unavailable outside the Bun runtime");
  }

  return new RedisClient(rawEnv.REDIS_URL ?? "redis://localhost:6379");
}

export function getRedisClient(rawEnv: Record<string, string | undefined> = process.env) {
  if (!sharedClient) {
    sharedClient = createRedisClient(rawEnv);
  }

  return sharedClient;
}

export function createRedisRateLimitClient(
  rawEnv: Record<string, string | undefined> = process.env
): RateLimitRedisClient {
  const client = getRedisClient(rawEnv);

  return {
    async scriptLoad(script: string) {
      const result = await client.send("SCRIPT", ["LOAD", script]);
      return String(result);
    },
    async evalsha(sha1: string, keys: string[], args: unknown[]) {
      return client.send("EVALSHA", [
        sha1,
        keys.length.toString(),
        ...keys,
        ...args.map(value => String(value)),
      ]);
    },
    decr(key: string) {
      return client.decr(key);
    },
    del(key: string) {
      return client.del(key);
    },
  };
}
