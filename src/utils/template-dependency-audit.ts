export type DependencySection =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies";

export interface DependencyOccurrence {
  filePath: string;
  lineNumber?: number;
  packageName: string;
  section: DependencySection;
  sourceType: "json" | "ts";
  spec: string;
}

export const DEPENDENCY_SECTIONS: DependencySection[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

const SIMPLE_VERSION_PREFIXES = ["^", "~", ""];
const VERSION_PATTERN = /\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/;

export function extractVersionFromSpec(spec: string): string | null {
  return spec.match(VERSION_PATTERN)?.[0] ?? null;
}

export function buildUpdatedSpec(spec: string, latestVersion: string): string | null {
  if (!isSupportedDependencySpec(spec)) {
    return null;
  }

  const prefix = SIMPLE_VERSION_PREFIXES.find(candidate => spec.startsWith(candidate));
  if (prefix == null) {
    return null;
  }

  return `${prefix}${latestVersion}`;
}

export function isSupportedDependencySpec(spec: string): boolean {
  if (
    spec.startsWith("workspace:") ||
    spec.startsWith("file:") ||
    spec.startsWith("link:") ||
    spec.startsWith("git+") ||
    spec.startsWith("github:") ||
    spec.startsWith("http://") ||
    spec.startsWith("https://") ||
    spec === "latest" ||
    spec.includes("||") ||
    spec.includes(" - ") ||
    spec.includes("*") ||
    spec.includes("x")
  ) {
    return false;
  }

  return extractVersionFromSpec(spec) !== null;
}

export function compareVersions(left: string, right: string): number {
  const leftParts = splitVersion(left);
  const rightParts = splitVersion(right);

  for (let index = 0; index < 3; index += 1) {
    const diff = leftParts.core[index] - rightParts.core[index];
    if (diff !== 0) {
      return diff;
    }
  }

  if (leftParts.prerelease.length === 0 && rightParts.prerelease.length === 0) {
    return 0;
  }

  if (leftParts.prerelease.length === 0) {
    return 1;
  }

  if (rightParts.prerelease.length === 0) {
    return -1;
  }

  const length = Math.max(leftParts.prerelease.length, rightParts.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftSegment = leftParts.prerelease[index];
    const rightSegment = rightParts.prerelease[index];

    if (leftSegment == null) {
      return -1;
    }

    if (rightSegment == null) {
      return 1;
    }

    const numericLeft = Number(leftSegment);
    const numericRight = Number(rightSegment);
    const bothNumeric = Number.isInteger(numericLeft) && Number.isInteger(numericRight);

    if (bothNumeric) {
      const diff = numericLeft - numericRight;
      if (diff !== 0) {
        return diff;
      }
      continue;
    }

    if (leftSegment !== rightSegment) {
      return leftSegment.localeCompare(rightSegment);
    }
  }

  return 0;
}

export function scanDependencyBlocksFromSource(
  source: string,
  filePath: string
): DependencyOccurrence[] {
  const occurrences: DependencyOccurrence[] = [];
  const lines = source.split("\n");
  let activeSection: DependencySection | null = null;
  let activeDepth = 0;

  for (const [index, line] of lines.entries()) {
    if (activeSection === null) {
      const sectionMatch = line.match(
        /^\s*(dependencies|devDependencies|peerDependencies|optionalDependencies):\s*{\s*$/
      );
      if (sectionMatch) {
        activeSection = sectionMatch[1] as DependencySection;
        activeDepth = 1;
      }
      continue;
    }

    const dependencyMatch = line.match(/^\s*"([^"]+)":\s*"([^"]+)",?\s*$/);
    if (dependencyMatch) {
      occurrences.push({
        filePath,
        lineNumber: index + 1,
        packageName: dependencyMatch[1],
        section: activeSection,
        sourceType: "ts",
        spec: dependencyMatch[2],
      });
    }

    activeDepth += countBraceDelta(line);
    if (activeDepth === 0) {
      activeSection = null;
    }
  }

  return occurrences;
}

export function collectJsonDependencyOccurrences(
  manifest: Record<string, unknown>,
  filePath: string
): DependencyOccurrence[] {
  const occurrences: DependencyOccurrence[] = [];

  for (const section of DEPENDENCY_SECTIONS) {
    const value = manifest[section];
    if (!isStringRecord(value)) {
      continue;
    }

    for (const [packageName, spec] of Object.entries(value)) {
      occurrences.push({
        filePath,
        packageName,
        section,
        sourceType: "json",
        spec,
      });
    }
  }

  return occurrences;
}

function countBraceDelta(line: string) {
  let delta = 0;

  for (const character of line) {
    if (character === "{") {
      delta += 1;
    } else if (character === "}") {
      delta -= 1;
    }
  }

  return delta;
}

function splitVersion(version: string) {
  const [corePart, prereleasePart] = version.split("-", 2);
  const core = corePart.split(".").map(part => Number.parseInt(part, 10));

  return {
    core: [core[0] ?? 0, core[1] ?? 0, core[2] ?? 0],
    prerelease: prereleasePart?.split(".") ?? [],
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(entry => typeof entry === "string");
}
