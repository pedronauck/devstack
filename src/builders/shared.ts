import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODULE_REGISTRY } from "../modules/index.ts";
import {
  type ModuleName,
  type SkillMapping,
  type StackModel,
  getBaseSkillMappings,
  getBaseSkills,
} from "../modules/types.ts";
import { copySelectedSubdirectories, writeTextFile } from "../utils/files.ts";
import { replaceTemplateTokens } from "../utils/template.ts";
import type { GenerateContext } from "./types.ts";

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const TEMPLATES_DIR = path.join(ROOT_DIR, "templates");
export const SKILLS_DIR = path.join(ROOT_DIR, "vendor", "skills", "skills");
export const INSTRUCTION_FILE_NAMES = ["CLAUDE.md", "AGENTS.md"] as const;
export const SKILL_TARGET_DIRS = [".claude/skills", ".agents/skills"] as const;

export function toJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function writeInstructionFiles(targetDir: string, content: string) {
  await Promise.all(
    INSTRUCTION_FILE_NAMES.map(fileName => writeTextFile(path.join(targetDir, fileName), content))
  );
}

export async function copySkillsToAgentDirs(
  targetDir: string,
  selectedSkills: Set<string>,
  context: GenerateContext
) {
  await Promise.all(
    SKILL_TARGET_DIRS.map(skillDir =>
      copySelectedSubdirectories(
        SKILLS_DIR,
        path.join(targetDir, skillDir),
        selectedSkills,
        context.tokens
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Simple builders (no stack-specific logic)
// ---------------------------------------------------------------------------

export function buildGitignore() {
  return (
    [
      "node_modules",
      ".turbo",
      "dist",
      "dist-ssr",
      "coverage",
      ".env",
      ".env.local",
      ".DS_Store",
      "storybook-static",
      "packages/*/dist",
      "packages/*/coverage",
      "packages/*/node_modules",
      ".codex/CONTINUITY.md",
    ].join("\n") + "\n"
  );
}

export function buildCommitlintConfig() {
  return ["export default {", '  extends: ["@commitlint/config-conventional"],', "};", ""].join(
    "\n"
  );
}

export function buildMakefile(context: GenerateContext) {
  return replaceTemplateTokens(
    [
      "ifneq (,$(wildcard .env))",
      "include .env",
      "export",
      "endif",
      "",
      "POSTGRES_CONTAINER ?= {{projectName}}-postgres",
      "POSTGRES_USER ?= postgres",
      "POSTGRES_DB ?= {{projectName}}",
      "",
      ".PHONY: check test lint fmt fmt-check typecheck dev db-reset",
      "",
      "check:",
      "\tbun run format",
      "\tbun run lint",
      "\tbun run typecheck",
      "\tbun run test",
      "",
      "test:",
      "\tbun run test",
      "",
      "lint:",
      "\tbun run lint",
      "",
      "fmt:",
      "\tbun run format",
      "",
      "fmt-check:",
      "\tbun run format:check",
      "",
      "typecheck:",
      "\tbun run typecheck",
      "",
      "dev:",
      "\tbun run dev",
      "",
      "db-reset:",
      '\tdocker exec "$(POSTGRES_CONTAINER)" psql -U "$(POSTGRES_USER)" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \\"$(POSTGRES_DB)\\" WITH (FORCE);"',
      '\tdocker exec "$(POSTGRES_CONTAINER)" psql -U "$(POSTGRES_USER)" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \\"$(POSTGRES_DB)\\";"',
      '\tdocker exec "$(POSTGRES_CONTAINER)" psql -U "$(POSTGRES_USER)" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \\"{{projectName}}_test\\" WITH (FORCE);"',
      '\tdocker exec "$(POSTGRES_CONTAINER)" psql -U "$(POSTGRES_USER)" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \\"{{projectName}}_test\\";"',
      "",
    ].join("\n"),
    context.tokens
  );
}

export function buildInitTestDbScript(context: GenerateContext) {
  return replaceTemplateTokens(
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "",
      'psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL',
      "  CREATE DATABASE {{projectName}}_test;",
      "EOSQL",
      "",
    ].join("\n"),
    context.tokens
  );
}

export function buildClaudeSettings() {
  return toJson({
    permissions: {
      allow: ["Bash(bun *)", "Bash(docker compose *)", "Bash(make *)"],
      deny: ["Bash(git reset:*)", "Bash(git clean:*)"],
    },
  });
}

// ---------------------------------------------------------------------------
// YAML serializer (used by buildDockerCompose)
// ---------------------------------------------------------------------------

export function serializeYaml(value: unknown, indent = 0): string {
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === "object" && item !== null) {
          const serialized = serializeYaml(item, indent + 2);
          const lines = serialized.split("\n");
          return `${" ".repeat(indent)}- ${lines[0]}\n${lines
            .slice(1)
            .map(line => (line ? `${" ".repeat(indent + 2)}${line}` : line))
            .join("\n")}`;
        }

        return `${" ".repeat(indent)}- ${String(item)}`;
      })
      .join("\n");
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value)
      .map(([key, currentValue]) => {
        if (
          Array.isArray(currentValue) ||
          (typeof currentValue === "object" && currentValue !== null)
        ) {
          return `${" ".repeat(indent)}${key}:\n${serializeYaml(currentValue, indent + 2)}`;
        }

        return `${" ".repeat(indent)}${key}: ${String(currentValue)}`;
      })
      .join("\n");
  }

  return `${" ".repeat(indent)}${String(value)}`;
}

// ---------------------------------------------------------------------------
// Docker Compose
// ---------------------------------------------------------------------------

export function buildDockerCompose(context: GenerateContext) {
  const services: Record<string, unknown> = {
    postgres: {
      image: "pgvector/pgvector:pg16",
      container_name: `${context.projectName}-postgres`,
      restart: "unless-stopped",
      ports: ["5432:5432"],
      environment: {
        POSTGRES_USER: "${POSTGRES_USER:-postgres}",
        POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:-postgres}",
        POSTGRES_DB: `\${POSTGRES_DB:-${context.projectName}}`,
      },
      volumes: [
        "postgres_data:/var/lib/postgresql/data",
        "./docker/postgres/init-test-db.sh:/docker-entrypoint-initdb.d/init-test-db.sh:ro",
      ],
      healthcheck: {
        test: [
          "CMD-SHELL",
          `pg_isready -U \${POSTGRES_USER:-postgres} -d \${POSTGRES_DB:-${context.projectName}}`,
        ],
        interval: "5s",
        timeout: "5s",
        retries: 20,
      },
    },
  };

  const volumes: Record<string, Record<string, never>> = {
    postgres_data: {},
  };

  for (const moduleName of context.resolvedModules) {
    for (const service of MODULE_REGISTRY[moduleName].dockerServices ?? []) {
      services[service.name] = {
        image: service.image,
        container_name: replaceTemplateTokens(
          service.containerName ?? `{{projectName}}-${service.name}`,
          context.tokens
        ),
        restart: "unless-stopped",
        ...(service.command ? { command: service.command } : {}),
        ...(service.dependsOn
          ? {
              depends_on: Object.fromEntries(
                service.dependsOn.map(item => [item, { condition: "service_healthy" }])
              ),
            }
          : {}),
        ...(service.ports ? { ports: service.ports } : {}),
        ...(service.environment ? { environment: service.environment } : {}),
        ...(service.volumes ? { volumes: service.volumes } : {}),
        ...(service.healthcheck ? { healthcheck: service.healthcheck } : {}),
      };

      for (const volume of service.volumes ?? []) {
        const [volumeName] = volume.split(":");
        if (volumeName && !volumeName.startsWith(".") && !volumeName.startsWith("/")) {
          volumes[volumeName] = {};
        }
      }
    }
  }

  return `services:\n${serializeYaml(services, 2)}\n\nvolumes:\n${serializeYaml(volumes, 2)}\n`;
}

// ---------------------------------------------------------------------------
// Skills resolution (stack-aware)
// ---------------------------------------------------------------------------

export function resolveSkillsForModules(
  resolvedModules: ModuleName[],
  stackModel: StackModel = "separated"
): Set<string> {
  const skills = new Set<string>(getBaseSkills(stackModel));

  for (const moduleName of resolvedModules) {
    const mod = MODULE_REGISTRY[moduleName];
    for (const skill of mod.skills ?? []) {
      skills.add(skill);
    }
  }

  return skills;
}

function buildSkillMappings(context: GenerateContext): SkillMapping[] {
  const moduleMappings = context.resolvedModules.flatMap(
    moduleName => MODULE_REGISTRY[moduleName].skillMappings ?? []
  );

  return [...getBaseSkillMappings(context.stackModel), ...moduleMappings];
}

// ---------------------------------------------------------------------------
// Skill enforcement and dispatch protocol (used by buildClaudeMd)
// ---------------------------------------------------------------------------

export type ClaudeMdBuilder = {
  buildClaudeMdArchitectureSection: (context: GenerateContext) => string;
  buildSkillEnforcementBackendSection: (context: GenerateContext) => string[];
  buildBackendArchitectureRules: () => string;
};

function buildSkillEnforcementSection(context: GenerateContext, builder: ClaudeMdBuilder) {
  const lines: string[] = [
    "## Skills Enforcement",
    "",
    "When working on this project, **always use the relevant skills** for the technology being touched:",
    "",
    "### React & Frontend",
    "",
    "- **React components/hooks/state**: Use `react` skill",
    "- **Routing/navigation**: Use `tanstack-router-best-practices` skill",
    "- **Data fetching/caching/mutations**: Use `tanstack-query-best-practices` skill",
    "- **State management (Zustand)**: Use `zustand` skill",
    "- **UI components (shadcn/ui, Radix)**: Use `shadcn` skill",
    "- **Building new components**: Use `building-components` skill",
    "- **React performance patterns**: Use `vercel-react-best-practices` skill",
    "- **Component composition/architecture**: Use `vercel-composition-patterns` skill",
    "- **Feature systems (domain modules)**: Use `app-renderer-systems` skill",
    "- **Advanced TypeScript patterns**: Use `typescript-advanced` skill",
    "- **Testing (Vitest)**: Use `vitest` skill",
    "",
    "### Backend & Database",
    "",
    ...builder.buildSkillEnforcementBackendSection(context),
  ];

  const moduleSkillLines: string[] = [];
  for (const moduleName of context.resolvedModules) {
    if (moduleName === "auth") {
      moduleSkillLines.push(
        "- **Authentication (Better Auth)**: Use `better-auth-best-practices` skill"
      );
    }
    if (moduleName === "organizations") {
      moduleSkillLines.push(
        "- **Organizations/multi-tenant**: Use `organization-best-practices` skill"
      );
    }
    if (moduleName === "stripe") {
      moduleSkillLines.push(
        "- **Payments (Stripe integration)**: Use `stripe-integration` + `stripe-best-practices` skills"
      );
      moduleSkillLines.push("- **Stripe subscriptions**: Use `stripe-subscriptions` skill");
      moduleSkillLines.push("- **Stripe webhooks**: Use `stripe-webhooks` skill");
    }
    if (moduleName === "inngest") {
      moduleSkillLines.push("- **Inngest (background jobs/workflows)**: Use `inngest` skill");
    }
    if (moduleName === "storybook") {
      moduleSkillLines.push("- **Storybook stories**: Use `storybook` skill");
    }
  }

  if (moduleSkillLines.length > 0) {
    lines.push(...moduleSkillLines);
    lines.push("");
  }

  lines.push(
    "",
    "### Design & UI/UX",
    "",
    "- **Frontend design/styling**: Use `frontend-design` and `ui-ux-pro-max` skills",
    "- **Interface design (dashboards, admin panels)**: Use `interface-design` skill",
    "- **UI review/accessibility audit**: Use `web-design-guidelines` skill",
    "",
    "### Process & Quality",
    "",
    "- **Before any creative/feature work**: Use `brainstorming` skill",
    "- **Executing implementation plans**: Use `executing-plans` skill",
    "- **Debugging/fixing bugs**: Use `no-workarounds` + `systematic-debugging` skills",
    "- **Writing/changing tests**: Use `test-antipatterns` skill",
    "- **Before claiming task is complete**: Use `verification-before-completion` skill",
    "- **Code review (cross-model)**: Use `adversarial-review` skill",
    "- **Architectural analysis/dead code**: Use `architectural-analysis` skill",
    "- **PR review fixes**: Use `fix-coderabbit-review` skill",
    "- **Git rebase/conflicts**: Use `git-rebase` skill",
    "- **Prompt generation for LLMs**: Use `to-prompt` skill",
    "- **Code analysis (Pal MCP)**: Use `pal` skill",
    "- **Discover/install skills**: Use `find-skills` skill"
  );

  return lines.join("\n");
}

function buildDispatchProtocolSection(context: GenerateContext) {
  const mappings = buildSkillMappings(context);

  const tableRows = mappings.map(m => {
    const req = m.required.map(s => `\`${s}\``).join(" + ");
    const cond = m.conditional?.length ? m.conditional.map(s => `\`${s}\``).join(" + ") : "";
    return `| ${m.domain} | ${req} | ${cond} |`;
  });

  const keywordSections = mappings.map(m => {
    return `- **${m.domain}** keywords: ${m.keywords.join(", ")}`;
  });

  return [
    "## Agent Skill Dispatch Protocol",
    "",
    "Every agent MUST follow this protocol before writing code:",
    "",
    "### Step 1: Identify Task Domain",
    "",
    "Scan the task description and target files to determine which domains are involved:",
    "",
    ...keywordSections,
    "",
    "### Step 2: Activate All Matching Skills",
    "",
    "Use the `Skill` tool to activate every skill that matches the identified domains:",
    "",
    "| Domain | Required Skills | Conditional Skills |",
    "| --- | --- | --- |",
    ...tableRows,
    "",
    "### Step 3: Verify Before Completion",
    "",
    "Before any agent marks a task as complete:",
    "",
    "1. Activate `verification-before-completion` skill",
    "2. Run `make check` (or `bun run lint && bun run typecheck && bun run test`)",
    "3. Read and verify the full output — no skipping",
    "4. Only then claim completion",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// CLAUDE.md builder (stack-aware via builder parameter)
// ---------------------------------------------------------------------------

export function buildClaudeMd(context: GenerateContext, builder: ClaudeMdBuilder) {
  const moduleSections = context.resolvedModules
    .map(moduleName => MODULE_REGISTRY[moduleName].claudeSection)
    .filter(Boolean)
    .join("\n\n");

  const skillEnforcement = buildSkillEnforcementSection(context, builder);
  const dispatchProtocol = buildDispatchProtocolSection(context);
  const architectureSection = builder.buildClaudeMdArchitectureSection(context);
  const backendRules = builder.buildBackendArchitectureRules();

  return replaceTemplateTokens(
    [
      "# CLAUDE.md",
      "",
      "This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.",
      "",
      "## HIGH PRIORITY",
      "",
      "- **IF YOU DON'T CHECK SKILLS** your task will be invalidated and we will generate rework",
      "- **YOU CAN ONLY** finish a task if `make check` passes at 100% (runs `format + lint-fix + typecheck + test`). No exceptions — failing any of these commands means the task is **NOT COMPLETE**",
      "- **`bun run lint` treats warnings as errors**. **Zero warnings allowed** — any oxlint warning is a blocking failure",
      "- **ALWAYS** check dependent file APIs before writing tests to avoid writing wrong code",
      "- **NEVER** use workarounds — always use the `no-workarounds` skill for any fix/debug task + `test-antipatterns` for tests",
      "- **ALWAYS** use the `no-workarounds` and `systematic-debugging` skills when fixing bugs or complex issues",
      "- **YOU MUST** use Context7 or Exa (`exa-web-search-free` skill) when researching external libraries/frameworks — always do **3-7 searches** with Exa for better results",
      "- **NEVER** use Context7 or Exa to search local project code — for local code, use Grep/Glob instead",
      "- **YOU SHOULD NEVER** install dependencies by hand in `package.json` without verifying the package exists — always use `bun add` instead",
      "",
      "## MANDATORY REQUIREMENTS",
      "",
      "- **MUST** run `make check` (or equivalently `bun run lint && bun run typecheck && bun run test`) before completing ANY subtask",
      "- **ALWAYS USE** the `react` skill before writing any React component",
      "- **ALWAYS USE** the `tanstack-router-best-practices` skill before working with routing",
      "- **ALWAYS USE** the `tanstack-query-best-practices` skill before working with data fetching",
      "- **ALWAYS USE** the `postgres-drizzle` + `drizzle-orm` skills before working with database code",
      "- **ALWAYS USE** the `drizzle-safe-migrations` skill before creating or modifying migrations",
      "- **ALWAYS FOLLOW** shadcn filename pattern with kebab-case for all React-related files",
      "- **Skipping any verification check will result in IMMEDIATE TASK REJECTION**",
      "",
      skillEnforcement,
      "",
      "## Commands",
      "",
      "```bash",
      "# Development",
      "bun run dev              # Start all dev servers (frontend + backend via Turbo)",
      "bun run build            # Build all workspaces",
      "",
      "# Quality",
      "bun run lint             # Format (oxfmt) + lint (oxlint)",
      "bun run typecheck        # Type check with tsc",
      "bun run format           # Format with oxfmt",
      "bun run test             # Run tests (Vitest)",
      "",
      "# Database",
      "docker compose up -d     # Start services (PostgreSQL + optional extras)",
      "bun run db:generate      # Generate Drizzle migrations",
      "bun run db:migrate       # Apply migrations",
      "",
      "# Makefile shortcuts",
      "make check               # Run format + lint-fix + typecheck + test",
      "make commit              # Run check pipeline + git add + opencommit",
      "make clean               # Remove node_modules, build artifacts, caches",
      "make update              # Interactive dependency update (taze)",
      "```",
      "",
      "## CRITICAL: Git Commands Restriction",
      "",
      "- **ABSOLUTELY FORBIDDEN**: **NEVER** run `git restore`, `git checkout`, `git reset`, `git clean`, `git rm`, or any other git commands that modify or discard working directory changes **WITHOUT EXPLICIT USER PERMISSION**",
      "- **DATA LOSS RISK**: These commands can **PERMANENTLY LOSE CODE CHANGES** and cannot be easily recovered",
      "- **REQUIRED ACTION**: If you need to revert or discard changes, **YOU MUST ASK THE USER FIRST**",
      "",
      "## Code Search and Discovery",
      "",
      "- **TOOL HIERARCHY**: Use tools in this order:",
      "  1. **Grep** / **Glob** — preferred for local project code",
      "  2. **Context7** — for external libraries and frameworks documentation",
      "  3. **Exa** (`exa-web-search-free` skill) — for web research, latest news, code examples. **Always perform 3-7 searches**",
      "- **FORBIDDEN**: Never use Context7 or Exa for local project code",
      "",
      architectureSection,
      "",
      moduleSections ? moduleSections : "",
      "",
      "## Frontend Architecture Rules",
      "",
      "### Principles",
      "",
      "- UI components **MUST** be pure and presentational; orchestration **MUST** live in pages/routes.",
      "- State management **MUST** be testable without UI coupling.",
      "- HTTP access **MUST** be isolated behind service boundaries.",
      "",
      "### Separation of Concerns",
      "",
      "- Routes/pages **MUST** orchestrate business logic and data fetching.",
      "- Components **MUST** be pure UI (no store or gateway access).",
      "- Stores **MUST** be framework-agnostic and testable without React.",
      "",
      "### Key Patterns",
      "",
      "- **File naming**: kebab-case for components (`.tsx`), hooks (`use-*.ts`), utilities (`.ts`)",
      "- **Exports**: Prefer named exports for components and utils",
      "- **Styling**: Tailwind CSS v4 with design tokens; Tailwind Variants for component variants",
      "",
      "### React Component Rules",
      "",
      "1. **Functional components only** — no class components, no `React.FC`",
      "2. **Separation of concerns** — extract behavior logic into custom hooks",
      "3. **State hierarchy** — local state > Zustand > TanStack Query > URL state",
      "4. **useEffect is an escape hatch** — only for external system sync",
      "5. **Handle all states** — always handle loading, error, and empty states",
      "6. **React 19+** — use `use()` hook, Actions, `useOptimistic()`, `useFormStatus()`; no `forwardRef`",
      "",
      backendRules,
      "",
      "## Coding Style & Naming Conventions",
      "",
      "- **TypeScript**: React 19, Tailwind 4; 2-space indent; semicolons; double quotes. Lint with Oxlint, format with Oxfmt (printWidth: 100)",
      "- File names: components `kebab-case.tsx`; hooks `use-kebab-case.ts`; utilities `kebab-case.ts`",
      "- Exports: prefer named exports for components and utils",
      "",
      "## Commit & Pull Request Guidelines",
      "",
      "- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `build:`",
      "- Before opening a PR: run `make check`",
      "- Do not rewrite unrelated files or reformat the whole repo — limit diffs to your change",
      "",
      "## Security & Configuration",
      "",
      "- Environment files: keep secrets in `.env` (never commit). Mirror keys in `.env.example`",
      "- Do not introduce unnecessary dependencies — audit every new package addition",
      "",
      dispatchProtocol,
      "",
      "## Anti-Patterns for Agents",
      "",
      "**NEVER do these:**",
      "",
      '1. **Skip skill activation** because "it\'s a small change" — every domain change requires its skill',
      "2. **Activate only one skill** when the code touches multiple domains",
      "3. **Forget `verification-before-completion`** before marking tasks done",
      "4. **Write tests without `test-antipatterns`** — leads to mock-testing-mocks and production pollution",
      "5. **Fix bugs without `systematic-debugging`** — leads to symptom-patching instead of root cause fixes",
      "6. **Apply workarounds without `no-workarounds`** — type assertions, lint suppressions, error swallowing are rejected",
      "7. **Claim task is done when any check has warnings or errors** — zero warnings, zero errors. No exceptions",
      "8. **Install dependencies by hand** — always use `bun add`",
      "9. **Use Context7 or Exa for local code** — only for external library documentation",
      "10. **Do only 1 Exa search** — always perform **3-7 searches** with varied queries",
      "11. **Run destructive git commands without permission** — `git restore`, `git reset`, `git clean` require explicit user approval",
      "",
    ].join("\n"),
    context.tokens
  );
}

// ---------------------------------------------------------------------------
// Patch lint plugin names
// ---------------------------------------------------------------------------

export async function patchPluginNames(context: GenerateContext) {
  const files = [
    "lint-plugins/react-component-complexity.mjs",
    "lint-plugins/react-hooks-separation.mjs",
    "lint-plugins/test-file-location.mjs",
  ];

  for (const relativePath of files) {
    const filePath = path.join(context.targetDir, relativePath);
    const content = await readFile(filePath, "utf8");
    const nextContent = content
      .replaceAll("dash-react-hooks", `${context.projectName}-react-hooks`)
      .replaceAll("dash-react", `${context.projectName}-react`)
      .replaceAll("dash-testing", `${context.projectName}-testing`);
    await writeTextFile(filePath, nextContent);
  }
}
