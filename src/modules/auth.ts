import type { ModuleDefinition } from "./types.ts";

export const authModule: ModuleDefinition = {
  name: "auth",
  label: "Authentication",
  hint: "Better Auth with email/password sessions.",
  envVars: [
    { key: "BETTER_AUTH_SECRET", value: "replace-with-32-char-secret" },
    { key: "BETTER_AUTH_URL", value: "http://localhost:3000" },
  ],
  backend: {
    dependencies: {
      "better-auth": "^1.5.5",
    },
    scripts: {
      "auth:generate": "bunx @better-auth/cli@latest generate --config ./src/lib/auth/auth.ts",
    },
  },
  claudeSection: `## Auth Module

- Better Auth is mounted at \`/api/auth\`.
- Session middleware protects \`/api/v1/*\`.
- Regenerate Better Auth schema when auth plugins change.
`,
  skills: ["better-auth-best-practices"],
  skillMappings: [
    {
      domain: "Authentication",
      keywords: ["auth", "session", "login", "signup", "Better Auth", "betterauth", "auth.ts"],
      required: ["better-auth-best-practices"],
    },
  ],
};
