import app from "./app";
import { env } from "./env";
import { logger } from "./lib/logger";

const server = Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
});

logger.info("Server started", {
  port: server.port,
  url: `http://localhost:${server.port}`,
});

process.on("SIGINT", () => {
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.stop();
  process.exit(0);
});
