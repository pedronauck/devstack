import { describe, expect, it } from "vitest";
import {
  buildUpdatedSpec,
  collectJsonDependencyOccurrences,
  compareVersions,
  extractVersionFromSpec,
  isSupportedDependencySpec,
  scanDependencyBlocksFromSource,
} from "../src/utils/template-dependency-audit.ts";

describe("template dependency audit helpers", () => {
  it("extracts versions from simple semver ranges", () => {
    expect(extractVersionFromSpec("^1.2.3")).toBe("1.2.3");
    expect(extractVersionFromSpec("~4.5.6-beta.1")).toBe("4.5.6-beta.1");
    expect(extractVersionFromSpec("workspace:*")).toBeNull();
  });

  it("preserves supported prefixes when building updated specs", () => {
    expect(buildUpdatedSpec("^1.2.3", "2.0.0")).toBe("^2.0.0");
    expect(buildUpdatedSpec("~1.2.3", "2.0.0")).toBe("~2.0.0");
    expect(buildUpdatedSpec("1.2.3", "2.0.0")).toBe("2.0.0");
  });

  it("rejects unsupported dependency specifiers", () => {
    expect(isSupportedDependencySpec("workspace:*")).toBe(false);
    expect(isSupportedDependencySpec("github:org/repo")).toBe(false);
    expect(isSupportedDependencySpec("^1.2.3")).toBe(true);
  });

  it("compares stable and prerelease versions correctly", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("1.2.4", "1.2.3")).toBeGreaterThan(0);
    expect(compareVersions("1.2.3-beta.1", "1.2.3")).toBeLessThan(0);
  });

  it("scans dependency blocks from TypeScript source", () => {
    const source = [
      "const config = {",
      "  dependencies: {",
      '    "react": "^19.0.0",',
      "  },",
      "  devDependencies: {",
      '    "vite": "^7.0.0",',
      "  },",
      "};",
      "",
    ].join("\n");

    expect(scanDependencyBlocksFromSource(source, "src/example.ts")).toEqual([
      {
        filePath: "src/example.ts",
        lineNumber: 3,
        packageName: "react",
        section: "dependencies",
        sourceType: "ts",
        spec: "^19.0.0",
      },
      {
        filePath: "src/example.ts",
        lineNumber: 6,
        packageName: "vite",
        section: "devDependencies",
        sourceType: "ts",
        spec: "^7.0.0",
      },
    ]);
  });

  it("collects dependency entries from package.json objects", () => {
    expect(
      collectJsonDependencyOccurrences(
        {
          dependencies: {
            stripe: "^14.0.0",
          },
          devDependencies: {
            jest: "^29.7.0",
          },
        },
        "templates/example/package.json"
      )
    ).toEqual([
      {
        filePath: "templates/example/package.json",
        packageName: "stripe",
        section: "dependencies",
        sourceType: "json",
        spec: "^14.0.0",
      },
      {
        filePath: "templates/example/package.json",
        packageName: "jest",
        section: "devDependencies",
        sourceType: "json",
        spec: "^29.7.0",
      },
    ]);
  });
});
