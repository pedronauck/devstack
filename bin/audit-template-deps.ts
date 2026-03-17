#!/usr/bin/env bun

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  buildUpdatedSpec,
  collectJsonDependencyOccurrences,
  compareVersions,
  extractVersionFromSpec,
  isSupportedDependencySpec,
  scanDependencyBlocksFromSource,
  type DependencyOccurrence,
  type DependencySection,
} from "../src/utils/template-dependency-audit.ts";

interface AuditResult extends DependencyOccurrence {
  latestVersion?: string;
  nextSpec?: string;
  status: "outdated" | "current" | "unsupported" | "unknown";
}

const ROOT_DIR = process.cwd();
const SOURCE_FILES = ["src/generator.ts", "src/builders/tanstack-start.ts"];
const SOURCE_DIRECTORIES = ["src/modules", "templates"];

async function main() {
  const shouldWrite = process.argv.includes("--write");
  const targetFiles = await findTargetFiles();
  const occurrences = await collectOccurrences(targetFiles);
  const packageNames = [...new Set(occurrences.map(entry => entry.packageName))].sort();
  const latestVersions = await fetchLatestVersions(packageNames);
  const results = occurrences
    .map(occurrence => auditOccurrence(occurrence, latestVersions))
    .sort(compareResults);

  printResults(results);

  if (shouldWrite) {
    await applyUpdates(results);
    console.log("");
    console.log("Updated outdated dependency specs in source files.");
  }

  const outdatedCount = results.filter(result => result.status === "outdated").length;
  process.exitCode = outdatedCount > 0 && !shouldWrite ? 1 : 0;
}

async function collectOccurrences(filePaths: string[]) {
  const occurrences = await Promise.all(
    filePaths.map(async filePath => {
      const absolutePath = path.join(ROOT_DIR, filePath);
      const content = await readFile(absolutePath, "utf8");

      if (filePath.endsWith(".json")) {
        const manifest = JSON.parse(content) as Record<string, unknown>;
        return collectJsonDependencyOccurrences(manifest, filePath);
      }

      return scanDependencyBlocksFromSource(content, filePath);
    })
  );

  return occurrences.flat();
}

function auditOccurrence(
  occurrence: DependencyOccurrence,
  latestVersions: Map<string, string | null>
): AuditResult {
  const latestVersion = latestVersions.get(occurrence.packageName) ?? null;
  if (!latestVersion) {
    return { ...occurrence, status: "unknown" };
  }

  if (!isSupportedDependencySpec(occurrence.spec)) {
    return { ...occurrence, latestVersion, status: "unsupported" };
  }

  const currentVersion = extractVersionFromSpec(occurrence.spec);
  if (!currentVersion) {
    return { ...occurrence, latestVersion, status: "unsupported" };
  }

  if (compareVersions(currentVersion, latestVersion) >= 0) {
    return { ...occurrence, latestVersion, status: "current" };
  }

  const nextSpec = buildUpdatedSpec(occurrence.spec, latestVersion);
  if (!nextSpec) {
    return { ...occurrence, latestVersion, status: "unsupported" };
  }

  return {
    ...occurrence,
    latestVersion,
    nextSpec,
    status: "outdated",
  };
}

async function applyUpdates(results: AuditResult[]) {
  const byFile = new Map<string, AuditResult[]>();

  for (const result of results) {
    if (result.status !== "outdated" || !result.nextSpec) {
      continue;
    }

    byFile.set(result.filePath, [...(byFile.get(result.filePath) ?? []), result]);
  }

  for (const [filePath, fileResults] of byFile) {
    const absolutePath = path.join(ROOT_DIR, filePath);
    if (filePath.endsWith(".json")) {
      const manifest = JSON.parse(await readFile(absolutePath, "utf8")) as Record<string, unknown>;
      for (const result of fileResults) {
        const section = manifest[result.section];
        if (typeof section === "object" && section && !Array.isArray(section)) {
          (section as Record<string, string>)[result.packageName] = result.nextSpec!;
        }
      }
      await writeFile(absolutePath, `${JSON.stringify(manifest, null, 4)}\n`, "utf8");
      continue;
    }

    const lines = (await readFile(absolutePath, "utf8")).split("\n");
    for (const result of fileResults) {
      if (!result.lineNumber) {
        continue;
      }

      const lineIndex = result.lineNumber - 1;
      const expression = new RegExp(
        `(\\s*"${escapeForRegExp(result.packageName)}":\\s*")([^"]+)(".*)`
      );
      lines[lineIndex] = lines[lineIndex].replace(expression, `$1${result.nextSpec}$3`);
    }
    await writeFile(absolutePath, `${lines.join("\n")}\n`, "utf8");
  }
}

function printResults(results: AuditResult[]) {
  const outdated = results.filter(result => result.status === "outdated");
  const unsupported = results.filter(result => result.status === "unsupported");
  const unknown = results.filter(result => result.status === "unknown");

  console.log(`Scanned ${results.length} dependency declarations across scaffold sources.`);
  console.log(
    `Outdated: ${outdated.length} | Unsupported: ${unsupported.length} | Unknown: ${unknown.length}`
  );

  if (outdated.length === 0) {
    return;
  }

  console.log("");
  for (const result of outdated) {
    const location = result.lineNumber
      ? `${result.filePath}:${result.lineNumber}`
      : result.filePath;
    console.log(
      `${location} [${result.section}] ${result.packageName} ${result.spec} -> ${result.nextSpec}`
    );
  }
}

async function fetchLatestVersions(packageNames: string[]) {
  const entries = await Promise.all(
    packageNames.map(async packageName => {
      const latestVersion = await fetchLatestVersion(packageName);
      return [packageName, latestVersion] as const;
    })
  );

  return new Map(entries);
}

async function fetchLatestVersion(packageName: string) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "devstack template dependency audit",
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    "dist-tags"?: {
      latest?: string;
    };
  };

  return payload["dist-tags"]?.latest ?? null;
}

async function findTargetFiles() {
  const files = new Set<string>(SOURCE_FILES);

  for (const directory of SOURCE_DIRECTORIES) {
    const nestedFiles = await walkFiles(directory);
    for (const filePath of nestedFiles) {
      const relativePath = path.relative(ROOT_DIR, filePath);
      if (relativePath.startsWith("src/modules/") && !relativePath.endsWith(".ts")) {
        continue;
      }

      if (relativePath.startsWith("templates/") && path.basename(relativePath) !== "package.json") {
        continue;
      }

      files.add(relativePath);
    }
  }

  return [...files].sort();
}

async function walkFiles(directory: string): Promise<string[]> {
  const absoluteDirectory = path.join(ROOT_DIR, directory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const filePaths = await Promise.all(
    entries.map(async entry => {
      const absolutePath = path.join(absoluteDirectory, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(path.join(directory, entry.name));
      }

      return [absolutePath];
    })
  );

  return filePaths.flat();
}

function compareResults(left: AuditResult, right: AuditResult) {
  return (
    compareStatus(left.status, right.status) ||
    left.filePath.localeCompare(right.filePath) ||
    compareSections(left.section, right.section) ||
    left.packageName.localeCompare(right.packageName)
  );
}

function compareStatus(left: AuditResult["status"], right: AuditResult["status"]) {
  const order: AuditResult["status"][] = ["outdated", "unsupported", "unknown", "current"];
  return order.indexOf(left) - order.indexOf(right);
}

function compareSections(left: DependencySection, right: DependencySection) {
  const order: DependencySection[] = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ];
  return order.indexOf(left) - order.indexOf(right);
}

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

await main();
