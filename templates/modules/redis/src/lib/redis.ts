const DEFAULT_REDIS_URL = "redis://localhost:6379";

type BunRedisClient = import("bun").RedisClient;

let sharedRedisClient: BunRedisClient | null = null;
let sharedRedisUrl: string | null = null;

export function getRedisClient(): BunRedisClient {
  const bun = globalThis as typeof globalThis & {
    Bun?: {
      RedisClient?: typeof import("bun").RedisClient;
    };
  };

  const RedisClient = bun.Bun?.RedisClient;

  if (!RedisClient) {
    throw new Error("Bun RedisClient is unavailable outside the Bun runtime");
  }

  const url = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;

  if (!sharedRedisClient || sharedRedisUrl !== url) {
    sharedRedisClient?.close();
    sharedRedisClient = new RedisClient(url);
    sharedRedisUrl = url;
  }

  return sharedRedisClient;
}
