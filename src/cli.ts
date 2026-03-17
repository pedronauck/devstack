import * as p from "@clack/prompts";
import color from "picocolors";
import { MODULE_OPTIONS, type StackModel } from "./modules/types.ts";

export interface GeneratorConfig {
  projectName: string;
  targetDir: string;
  stackModel: StackModel;
  selectedModules: string[];
  initGit: boolean;
  installDependencies: boolean;
}

function ensureNotCancelled<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  return value as T;
}

export async function runCli(): Promise<GeneratorConfig> {
  p.intro(color.bgCyan(color.black(" devstack ")));

  const projectName = ensureNotCancelled(
    await p.text({
      message: "What is your app name?",
      placeholder: "my-saas",
      validate(value) {
        if (!value) {
          return "App name is required";
        }

        if (!/^[a-z][a-z0-9-]*$/.test(value)) {
          return "Must be lowercase with hyphens only";
        }

        return undefined;
      },
    })
  );

  const targetDir = ensureNotCancelled(
    await p.text({
      message: "Where to create the project?",
      initialValue: `./${projectName}`,
      validate(value) {
        if (!value) {
          return "Target directory is required";
        }

        return undefined;
      },
    })
  );

  const stackModel = ensureNotCancelled(
    await p.select({
      message: "Choose your stack:",
      options: [
        {
          value: "separated" as const,
          label: "Separated (Hono API + Vite React)",
          hint: "packages/frontend + packages/backend",
        },
        {
          value: "tanstack-start" as const,
          label: "TanStack Start (Fullstack)",
          hint: "packages/app with Server Functions + SSR",
        },
      ],
    })
  );

  const selectedModules = ensureNotCancelled(
    await p.multiselect({
      message: "Select optional modules:",
      required: false,
      options: MODULE_OPTIONS,
    })
  );

  const installDependencies = ensureNotCancelled(
    await p.confirm({
      message: "Install dependencies after scaffolding?",
      initialValue: true,
    })
  );

  const initGit = ensureNotCancelled(
    await p.confirm({
      message: "Initialize git repository?",
      initialValue: true,
    })
  );

  return {
    projectName,
    targetDir,
    stackModel,
    selectedModules,
    initGit,
    installDependencies,
  };
}
