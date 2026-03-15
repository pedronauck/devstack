import type { ModuleDefinition } from "./types.ts";

export const redisModule: ModuleDefinition = {
  name: "redis",
  label: "Redis",
  hint: "Redis client and rate limiting middleware.",
  envVars: [
    { key: "REDIS_URL", value: "redis://localhost:6379" },
    { key: "RATE_LIMIT_WINDOW_MS", value: "60000" },
    { key: "RATE_LIMIT_AUTHENTICATED_LIMIT", value: "300" },
    { key: "RATE_LIMIT_PUBLIC_LIMIT", value: "30" },
    { key: "RATE_LIMIT_WEBHOOK_LIMIT", value: "120" },
  ],
  dockerServices: [
    {
      name: "redis",
      image: "redis:7-alpine",
      ports: ["6379:6379"],
      command: ["redis-server", "--appendonly", "yes"],
      volumes: ["redis_data:/data"],
      healthcheck: {
        test: ["CMD", "redis-cli", "ping"],
        interval: "5s",
        timeout: "3s",
        retries: 20,
      },
    },
  ],
  backend: {
    dependencies: {
      "@hono-rate-limiter/redis": "^0.1.4",
      "hono-rate-limiter": "^0.5.3",
    },
  },
};
