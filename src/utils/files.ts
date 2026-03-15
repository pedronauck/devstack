import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { replaceTemplateTokens, type TemplateVariables } from "./template.ts";

const TEXT_FILE_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sh",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const SKIPPED_BASENAMES = new Set([".DS_Store"]);

function shouldTreatAsText(filePath: string) {
  return TEXT_FILE_EXTENSIONS.has(path.extname(filePath));
}

export async function ensureEmptyDirectory(targetDir: string) {
  await rm(targetDir, { force: true, recursive: true });
  await mkdir(targetDir, { recursive: true });
}

export async function ensureDirectory(targetDir: string) {
  await mkdir(targetDir, { recursive: true });
}

export async function copyDirectory(sourceDir: string, targetDir: string) {
  await ensureDirectory(targetDir);
  await cp(sourceDir, targetDir, {
    recursive: true,
    force: true,
    filter(sourcePath) {
      return !SKIPPED_BASENAMES.has(path.basename(sourcePath));
    },
  });
}

export async function copyDirectoryWithTemplates(
  sourceDir: string,
  targetDir: string,
  variables: TemplateVariables
) {
  await copyDirectory(sourceDir, targetDir);
  await replaceTokensInDirectory(targetDir, variables);
}

export async function walkFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const fullPath = path.join(rootDir, entry.name);
      if (SKIPPED_BASENAMES.has(entry.name)) {
        return [];
      }

      if (entry.isDirectory()) {
        return walkFiles(fullPath);
      }

      return [fullPath];
    })
  );

  return files.flat();
}

export async function replaceTokensInDirectory(rootDir: string, variables: TemplateVariables) {
  const files = await walkFiles(rootDir);

  await Promise.all(
    files.map(async filePath => {
      if (!shouldTreatAsText(filePath)) {
        return;
      }

      const raw = await readFile(filePath, "utf8");
      const next = replaceTemplateTokens(raw, variables);

      if (next !== raw) {
        await writeFile(filePath, next, "utf8");
      }
    })
  );
}

export async function writeTextFile(filePath: string, content: string) {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, content, "utf8");
}

export async function readTextFile(filePath: string) {
  return readFile(filePath, "utf8");
}

export async function pathExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function copySelectedSubdirectories(
  sourceDir: string,
  targetDir: string,
  selectedNames: Set<string>,
  variables: TemplateVariables
) {
  await ensureDirectory(targetDir);
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (!selectedNames.has(entry.name)) {
      continue;
    }

    const src = path.join(sourceDir, entry.name);
    const dest = path.join(targetDir, entry.name);
    await copyDirectoryWithTemplates(src, dest, variables);
  }
}

export const ensureDir = ensureDirectory;
export const fileExists = pathExists;
