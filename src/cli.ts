import * as p from "@clack/prompts";
import color from "picocolors";
import { MODULE_OPTIONS } from "./modules/types.ts";

export interface GeneratorConfig {
  projectName: string;
  targetDir: string;
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
  p.intro(color.bgCyan(color.black(" @compozy/devstack ")));

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
    selectedModules,
    initGit,
    installDependencies,
  };
}
