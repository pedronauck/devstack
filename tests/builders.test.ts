import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SEPARATED_STACK_MODEL } from "../src/builders/separated.ts";
import {
  buildDockerCompose,
  buildGitignore,
  patchPluginNames,
  resolveSkillsForModules,
  serializeYaml,
} from "../src/builders/shared.ts";
import type { GenerateContext } from "../src/builders/types.ts";
import { buildTemplateTokens } from "../src/utils/template.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { force: true, recursive: true })));
});

function createContext(overrides: Partial<GenerateContext> = {}): GenerateContext {
  return {
    projectName: "acme-app",
    stackModel: "separated",
    resolvedModules: [],
    targetDir: "/tmp/acme-app",
    tokens: buildTemplateTokens("acme-app"),
    ...overrides,
  };
}

describe("builders/shared", () => {
  it("exports the separated stack identifier", () => {
    expect(SEPARATED_STACK_MODEL).toBe("separated");
  });

  it("serializes arrays and nested objects into yaml-like text", () => {
    const yaml = serializeYaml({
      services: {
        postgres: {
          ports: ["5432:5432"],
          environment: {
            POSTGRES_DB: "acme-app",
          },
        },
      },
    });

    expect(yaml).toContain("services:");
    expect(yaml).toContain("ports:");
    expect(yaml).toContain("- 5432:5432");
    expect(yaml).toContain("POSTGRES_DB: acme-app");
  });

  it("builds docker compose with module services and derived volumes", () => {
    const compose = buildDockerCompose(createContext({ resolvedModules: ["redis"] }));

    expect(compose).toContain("container_name: acme-app-postgres");
    expect(compose).toContain("redis:");
    expect(compose).toContain("redis_data:");
  });

  it("resolves stack-aware skill sets", () => {
    const separatedSkills = resolveSkillsForModules(["auth"], "separated");
    const tanstackSkills = resolveSkillsForModules(["auth"], "tanstack-start");

    expect(separatedSkills.has("hono")).toBe(true);
    expect(separatedSkills.has("tanstack-start-best-practices")).toBe(false);
    expect(tanstackSkills.has("tanstack-start-best-practices")).toBe(true);
    expect(tanstackSkills.has("better-auth-best-practices")).toBe(true);
  });

  it("patches lint plugin names with the project prefix", async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), "devstack-builders-"));
    tempDirs.push(targetDir);

    const pluginFiles = [
      "lint-plugins/react-component-complexity.mjs",
      "lint-plugins/react-hooks-separation.mjs",
      "lint-plugins/test-file-location.mjs",
    ];

    await mkdir(path.join(targetDir, "lint-plugins"), { recursive: true });

    for (const file of pluginFiles) {
      await writeFile(
        path.join(targetDir, file),
        "dash-react-hooks\ndash-react\ndash-testing\n",
        "utf8"
      );
    }

    await patchPluginNames(createContext({ targetDir }));

    const patched = await readFile(path.join(targetDir, pluginFiles[0]), "utf8");
    expect(patched).toContain("acme-app-react-hooks");
    expect(patched).toContain("acme-app-react");
    expect(patched).toContain("acme-app-testing");
  });

  it("includes continuity tracking in the generated gitignore", () => {
    expect(buildGitignore()).toContain(".codex/CONTINUITY.md");
  });
});
