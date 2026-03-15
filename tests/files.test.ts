import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { copyDirectoryWithTemplates, ensureDirectory, writeTextFile } from "../src/utils/files.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(directory => rm(directory, { force: true, recursive: true }))
  );
});

describe("copyDirectoryWithTemplates", () => {
  it("copies files and replaces tokens only in text files", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "devstack-files-"));
    tempDirs.push(rootDir);

    const sourceDir = path.join(rootDir, "source");
    const targetDir = path.join(rootDir, "target");

    await ensureDirectory(sourceDir);
    await writeTextFile(path.join(sourceDir, "README.md"), "# {{projectTitle}}\n");
    await writeFile(path.join(sourceDir, "logo.bin"), Buffer.from("{{projectTitle}}"));

    await copyDirectoryWithTemplates(sourceDir, targetDir, {
      projectName: "my-saas",
      projectTitle: "My Saas",
    });

    await expect(readFile(path.join(targetDir, "README.md"), "utf8")).resolves.toBe("# My Saas\n");
    await expect(readFile(path.join(targetDir, "logo.bin"), "utf8")).resolves.toBe(
      "{{projectTitle}}"
    );
  });
});
