export interface PackageJsonShape {
  name?: string;
  private?: boolean;
  packageManager?: string;
  type?: string;
  workspaces?: string[];
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  lintStaged?: Record<string, string[]>;
  [key: string]: unknown;
}

function sortRecord(record: Record<string, string> = {}) {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right))
  );
}

export function mergePackageJson(
  basePackage: PackageJsonShape,
  ...patches: Array<Partial<PackageJsonShape> | undefined>
): PackageJsonShape {
  return patches.reduce<PackageJsonShape>(
    (accumulator, patch) => {
      if (!patch) {
        return accumulator;
      }

      const next: PackageJsonShape = {
        ...accumulator,
        ...patch,
      };

      next.scripts = sortRecord({
        ...accumulator.scripts,
        ...patch.scripts,
      });
      next.dependencies = sortRecord({
        ...accumulator.dependencies,
        ...patch.dependencies,
      });
      next.devDependencies = sortRecord({
        ...accumulator.devDependencies,
        ...patch.devDependencies,
      });

      if (accumulator.lintStaged || patch.lintStaged) {
        next.lintStaged = {
          ...accumulator.lintStaged,
          ...patch.lintStaged,
        };
      }

      return next;
    },
    { ...basePackage }
  );
}
