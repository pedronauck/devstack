import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["templates/**", "vendor/**", "dist/**", "node_modules/**"],
  },
});
