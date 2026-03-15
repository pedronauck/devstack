import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    name: "backend",
    environment: "node",
    globals: true,
    fileParallelism: false,
    hookTimeout: 30000,
    maxWorkers: 1,
    pool: "forks",
    testTimeout: 30000,
    include: ["src/**/*.{test,spec}.ts", "tests/**/*.{test,spec}.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    setupFiles: ["./src/test-setup.ts"],
  },
});
