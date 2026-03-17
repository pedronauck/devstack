import { defineConfig } from "bumpp";

export default defineConfig({
  commit: "chore: release v%s",
  tag: true,
  push: true,
  execute: "make check",
});
