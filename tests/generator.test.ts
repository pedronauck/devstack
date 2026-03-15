import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

describe("generateProject", () => {
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
    const tsconfig = JSON.parse(await readFile(path.join(appDir, "tsconfig.json"), "utf8"));
    const testSetup = await readFile(path.join(appDir, "src/test-setup.ts"), "utf8");

    expect(tsconfig.compilerOptions.paths).toMatchObject({
      "@/*": ["./src/*"],
      "~/*": ["./*"],
    });
    expect(testSetup).toContain('import "@testing-library/jest-dom";');
    expect(testSetup).toContain("window.ResizeObserver = ResizeObserverMock;");
  });

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
    }
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
