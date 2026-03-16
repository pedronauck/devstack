import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { GeneratorConfig } from "../src/cli.ts";
import { generateProject } from "../src/generator.ts";
import { MODULE_ORDER } from "../src/modules/types.ts";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map(dir => rm(dir, { force: true, recursive: true })));
});

async function scaffoldProject(overrides: Partial<GeneratorConfig> = {}) {
  const targetDir = await mkdtemp(path.join(os.tmpdir(), "devstack-generator-"));
  createdDirs.push(targetDir);

  await generateProject({
    projectName: "acme-app",
    targetDir,
    stackModel: "separated",
    selectedModules: [],
    initGit: false,
    installDependencies: false,
    ...overrides,
  });

  return targetDir;
}

async function runCommand(command: string, args: string[], cwd: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "pipe",
    });

    let output = "";
    child.stdout.on("data", chunk => {
      output += String(chunk);
    });
    child.stderr.on("data", chunk => {
      output += String(chunk);
    });

    child.on("error", reject);
    child.on("exit", code => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(`${command} ${args.join(" ")} failed with code ${code ?? "unknown"}\n${output}`)
      );
    });
  });
}

async function listRelativeFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { recursive: true, withFileTypes: true });

  return entries
    .filter(entry => entry.isFile())
    .map(entry => path.relative(rootDir, path.join(entry.parentPath, entry.name)))
    .sort();
}

describe("generateProject", () => {
  it.each([["separated" as const], ["tanstack-start" as const]])(
    "mirrors Claude guidance and selected skills for %s",
    async stackModel => {
      const targetDir = await scaffoldProject({
        stackModel,
        selectedModules: ["auth", "redis"],
      });

      const claudeMd = await readFile(path.join(targetDir, "CLAUDE.md"), "utf8");
      const agentsMd = await readFile(path.join(targetDir, "AGENTS.md"), "utf8");
      const claudeSkills = await listRelativeFiles(path.join(targetDir, ".claude/skills"));
      const agentSkills = await listRelativeFiles(path.join(targetDir, ".agents/skills"));

      expect(agentsMd).toBe(claudeMd);
      expect(agentSkills).toEqual(claudeSkills);
      expect(agentSkills).toEqual(
        expect.arrayContaining([
          "better-auth-best-practices/SKILL.md",
          "postgres-drizzle/SKILL.md",
          "react/SKILL.md",
        ])
      );
    },
    45_000
  );

  it.each([["separated" as const], ["tanstack-start" as const]])(
    "writes a root test script that delegates to workspace tests for %s",
    async stackModel => {
      const targetDir = await scaffoldProject({ stackModel });
      const packageJson = JSON.parse(await readFile(path.join(targetDir, "package.json"), "utf8"));

      expect(packageJson.scripts.test).toBe("turbo run test");
    }
  );

  it("creates a usable TanStack Start app shell with the expected shared test setup and aliases", async () => {
    const targetDir = await scaffoldProject({ stackModel: "tanstack-start" });
    const appDir = path.join(targetDir, "packages/app");
    const packageJson = JSON.parse(await readFile(path.join(appDir, "package.json"), "utf8"));
    const tsconfig = JSON.parse(await readFile(path.join(appDir, "tsconfig.json"), "utf8"));
    const viteConfig = await readFile(path.join(appDir, "vite.config.ts"), "utf8");
    const routeTree = await readFile(path.join(appDir, "src/routeTree.gen.ts"), "utf8");
    const testSetup = await readFile(path.join(appDir, "src/test-setup.ts"), "utf8");
    const rootRoute = await readFile(path.join(appDir, "src/routes/__root.tsx"), "utf8");

    expect(packageJson.scripts.dev).toBe("vite dev");
    expect(packageJson.scripts.build).toBe("vite build");
    expect(packageJson.scripts.typecheck).toBe("bunx tsgo --noEmit");
    expect(packageJson.dependencies.vinxi).toBeUndefined();
    expect(packageJson.devDependencies["@tanstack/router-cli"]).toBeUndefined();
    expect(packageJson.devDependencies["vite-tsconfig-paths"]).toBe("^6.1.1");
    expect(tsconfig.compilerOptions.allowImportingTsExtensions).toBe(true);
    expect(tsconfig.compilerOptions.paths).toMatchObject({
      "@/*": ["./src/*"],
      "~/*": ["./*"],
    });
    expect(tsconfig.compilerOptions.types).toContain("vite/client");
    expect(tsconfig.include).toContain("vite.config.ts");
    expect(viteConfig).toContain("@tanstack/react-start/plugin/vite");
    expect(viteConfig).toContain("tanstackStart({");
    expect(routeTree).toContain('import { Route as rootRouteImport } from "./routes/__root";');
    expect(routeTree).toContain(
      'import { Route as ApiHealthRouteImport } from "./routes/api/health";'
    );
    expect(routeTree).toContain('import type { getRouter } from "./router.tsx";');
    expect(routeTree).toContain('declare module "@tanstack/react-start" {');
    expect(testSetup).toContain('import "@testing-library/jest-dom";');
    expect(testSetup).toContain("window.ResizeObserver = ResizeObserverMock;");
    expect(rootRoute).toContain('/// <reference types="vite/client" />');
    expect(rootRoute).toContain("const faviconHref =");
    expect(rootRoute).toContain("data:image/svg+xml,");
    expect(rootRoute).toContain('{ rel: "icon", href: faviconHref, type: "image/svg+xml" }');
    expect(rootRoute).toContain("  return <Outlet />;");
    expect(rootRoute).not.toContain("<RootDocument>");
  });

  it("includes generated TanStack route tree entries for optional API routes", async () => {
    const targetDir = await scaffoldProject({
      stackModel: "tanstack-start",
      selectedModules: ["auth", "stripe", "inngest"],
    });
    const routeTree = await readFile(
      path.join(targetDir, "packages/app/src/routeTree.gen.ts"),
      "utf8"
    );

    expect(routeTree).toContain(
      'import { Route as ApiAuthSplatRouteImport } from "./routes/api/auth/$";'
    );
    expect(routeTree).toContain(
      'import { Route as ApiWebhooksStripeRouteImport } from "./routes/api/webhooks/stripe";'
    );
    expect(routeTree).toContain(
      'import { Route as ApiInngestRouteImport } from "./routes/api/inngest";'
    );
    expect(routeTree).toContain('"/api/auth/$": typeof ApiAuthSplatRoute;');
    expect(routeTree).toContain('"/api/webhooks/stripe": typeof ApiWebhooksStripeRoute;');
    expect(routeTree).toContain('"/api/inngest": typeof ApiInngestRoute;');
  });

  it.each([["separated" as const], ["tanstack-start" as const]])(
    "generates scaffold output that already passes oxfmt check for %s",
    async stackModel => {
      const targetDir = await scaffoldProject({ stackModel });

      await runCommand("bunx", ["oxfmt", "--check", "."], targetDir);
    }
  );

  it("includes Redis rate limit env vars in the TanStack Start schema and env example", async () => {
    const targetDir = await scaffoldProject({
      stackModel: "tanstack-start",
      selectedModules: ["redis"],
    });
    const appDir = path.join(targetDir, "packages/app");
    const envSchema = await readFile(path.join(appDir, "server/lib/env.ts"), "utf8");
    const envExample = await readFile(path.join(appDir, ".env.example"), "utf8");

    expect(envSchema).toContain("RATE_LIMIT_WINDOW_MS");
    expect(envSchema).toContain("RATE_LIMIT_AUTHENTICATED_LIMIT");
    expect(envSchema).toContain("RATE_LIMIT_PUBLIC_LIMIT");
    expect(envSchema).toContain("RATE_LIMIT_WEBHOOK_LIMIT");
    expect(envExample).toContain("RATE_LIMIT_WINDOW_MS=60000");
    expect(envExample).toContain("RATE_LIMIT_AUTHENTICATED_LIMIT=300");
    expect(envExample).toContain("RATE_LIMIT_PUBLIC_LIMIT=30");
    expect(envExample).toContain("RATE_LIMIT_WEBHOOK_LIMIT=120");
  });

  it("ships the separated backend shared test-utils baseline", async () => {
    const targetDir = await scaffoldProject({ stackModel: "separated" });
    const backendDir = path.join(targetDir, "packages/backend/src");
    const testDb = await readFile(path.join(backendDir, "test-utils/db.ts"), "utf8");
    const testRequest = await readFile(path.join(backendDir, "test-utils/request.ts"), "utf8");
    const testFactories = await readFile(path.join(backendDir, "test-utils/factories.ts"), "utf8");

    expect(testDb).toContain("setupTestDatabase");
    expect(testDb).toContain("withTestTransaction");
    expect(testRequest).toContain("export async function testRequest");
    expect(testFactories).toContain("createTestItem");
  });

  it("builds a TanStack Start backend baseline with real shared libs and infra modules", async () => {
    const targetDir = await scaffoldProject({
      stackModel: "tanstack-start",
      selectedModules: ["observability", "redis"],
    });
    const appDir = path.join(targetDir, "packages/app");
    const serverEntry = await readFile(path.join(appDir, "src/server.ts"), "utf8");
    const loggerLib = await readFile(path.join(appDir, "server/lib/logger.ts"), "utf8");
    const requestContextLib = await readFile(
      path.join(appDir, "server/lib/request-context.ts"),
      "utf8"
    );
    const healthRoute = await readFile(path.join(appDir, "src/routes/api/health.ts"), "utf8");
    const tracingLib = await readFile(path.join(appDir, "server/lib/tracing.ts"), "utf8");
    const sentryLib = await readFile(path.join(appDir, "server/lib/sentry.ts"), "utf8");
    const redisLib = await readFile(path.join(appDir, "server/lib/redis.ts"), "utf8");
    const rateLimitLib = await readFile(
      path.join(appDir, "server/middleware/rate-limit.ts"),
      "utf8"
    );
    const testDb = await readFile(path.join(appDir, "server/test-utils/db.ts"), "utf8");
    const testFactories = await readFile(
      path.join(appDir, "server/test-utils/factories.ts"),
      "utf8"
    );

    expect(serverEntry).toContain("configureBackendLogger()");
    expect(serverEntry).toContain("resolveRequestId");
    expect(loggerLib).toContain("@logtape/logtape");
    expect(requestContextLib).toContain('export const REQUEST_ID_HEADER = "X-Request-Id"');
    expect(healthRoute).toContain("checkPostgresReadiness");
    expect(healthRoute).toContain("checkRedisReadiness");
    expect(healthRoute).toContain('const checks: Record<string, "ok" | "error"> = {');
    expect(tracingLib).toContain("NodeSDK");
    expect(tracingLib).not.toContain("Add OpenTelemetry SDK initialization here");
    expect(sentryLib).toContain("Sentry.init");
    expect(redisLib).toContain("createRedisRateLimitClient");
    expect(redisLib).not.toContain("Use your preferred Redis client here");
    expect(rateLimitLib).toContain("authenticatedRateLimitConfig");
    expect(rateLimitLib).toContain("getRedisClient()");
    expect(testDb).toContain("withTestTransaction");
    expect(testFactories).toContain("createTestItem");
  });

  it.each([
    [
      "separated" as const,
      "packages/backend/src/plugins/auth.ts",
      "export { auth }",
      "packages/frontend/.storybook/main.ts",
    ],
    [
      "tanstack-start" as const,
      "packages/app/server/lib/auth/auth.ts",
      "betterAuth",
      "packages/app/.storybook/main.ts",
    ],
  ])(
    "scaffolds every optional module for %s",
    async (stackModel, authFilePath, authNeedle, storybookFilePath) => {
      const targetDir = await scaffoldProject({
        stackModel,
        selectedModules: [...MODULE_ORDER],
      });

      await expect(readFile(path.join(targetDir, authFilePath), "utf8")).resolves.toContain(
        authNeedle
      );
      await expect(readFile(path.join(targetDir, storybookFilePath), "utf8")).resolves.toContain(
        "StorybookConfig"
      );
      await expect(readFile(path.join(targetDir, "docker-compose.yml"), "utf8")).resolves.toContain(
        "redis:"
      );
    },
    45_000
  );

  it("rejects non-empty target directories before scaffolding", async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), "devstack-non-empty-"));
    createdDirs.push(targetDir);
    await writeFile(path.join(targetDir, "existing.txt"), "already here", "utf8");

    await expect(
      generateProject({
        projectName: "acme-app",
        targetDir,
        stackModel: "separated",
        selectedModules: [],
        initGit: false,
        installDependencies: false,
      })
    ).rejects.toThrow(`Target directory is not empty: ${targetDir}`);
  });
});
