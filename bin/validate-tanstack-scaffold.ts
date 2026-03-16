#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { generateProject } from "../src/generator.ts";

async function runCommand(command: string, args: string[], cwd: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", code => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with code ${code ?? "unknown"}`));
    });
  });
}

async function main() {
  const keepTemp = process.argv.includes("--keep-temp");
  const targetDir = await mkdtemp(path.join(os.tmpdir(), "devstack-tanstack-smoke-"));
  const appRoot = path.join(targetDir, "acme-app");
  let passed = false;

  try {
    console.log(`Scaffolding TanStack smoke project in ${appRoot}`);
    await generateProject({
      projectName: "acme-app",
      targetDir: appRoot,
      stackModel: "tanstack-start",
      selectedModules: [],
      initGit: false,
      installDependencies: false,
    });

    console.log("Installing generated project dependencies");
    await runCommand("bun", ["install"], appRoot);

    console.log("Checking generated project lint pipeline");
    await runCommand("bun", ["run", "lint"], appRoot);

    console.log("Checking generated project type safety");
    await runCommand("bun", ["run", "typecheck"], appRoot);

    passed = true;
    console.log("TanStack scaffold smoke validation passed.");
  } catch (error) {
    console.error(`TanStack scaffold smoke validation failed. Project kept at: ${appRoot}`);
    throw error;
  } finally {
    if (passed && !keepTemp) {
      await rm(targetDir, { force: true, recursive: true });
    }
  }
}

await main();
