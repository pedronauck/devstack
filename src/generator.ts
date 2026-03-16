import { spinner } from "@clack/prompts";
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { GeneratorConfig } from "./cli.ts";
import { MODULE_REGISTRY, resolveSelectedModules } from "./modules/index.ts";
import type { ModuleName } from "./modules/types.ts";
import {
  copyDirectoryWithTemplates as copyDirectory,
  ensureDir,
  fileExists,
  pathExists,
  writeTextFile,
} from "./utils/files.ts";
import { mergePackageJson, type PackageJsonShape } from "./utils/packages.ts";
import { buildTemplateTokens, replaceTemplateTokens } from "./utils/template.ts";
import { generateTanStackStart } from "./builders/tanstack-start.ts";
import {
  type ClaudeMdBuilder,
  buildClaudeMd,
  buildClaudeSettings,
  buildCommitlintConfig,
  buildDockerCompose,
  buildGitignore,
  buildInitTestDbScript,
  buildMakefile,
  copySkillsToAgentDirs,
  patchPluginNames,
  resolveSkillsForModules,
  SKILLS_DIR,
  TEMPLATES_DIR,
  toJson,
  writeInstructionFiles,
} from "./builders/shared.ts";
import type { GenerateContext } from "./builders/types.ts";

export interface GenerateResult {
  resolvedModules: ModuleName[];
  targetDir: string;
}

const BASE_ROOT_DIR = path.join(TEMPLATES_DIR, "base", "root");
const BASE_FRONTEND_DIR = path.join(TEMPLATES_DIR, "base", "frontend");
const BASE_BACKEND_DIR = path.join(TEMPLATES_DIR, "base", "backend");

function resolveTargetDirectory(targetDir: string) {
  return path.resolve(process.cwd(), targetDir);
}

async function resolveModuleOverlayTargetDir(targetDir: string, overlayDir: string) {
  const entries = await readdir(overlayDir, { withFileTypes: true });
  const hasWorkspaceRootEntries = entries.some(
    entry =>
      entry.name === "packages" ||
      entry.name.startsWith(".") ||
      entry.name === "package.json" ||
      entry.name === "turbo.json"
  );

  return hasWorkspaceRootEntries ? targetDir : path.join(targetDir, "packages/backend");
}

async function assertTargetDirectoryIsReady(targetDir: string) {
  if (!(await fileExists(targetDir))) {
    return;
  }

  const entries = await readdir(targetDir);
  if (entries.length > 0) {
    throw new Error(`Target directory is not empty: ${targetDir}`);
  }
}

function runCommand(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
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

function buildRootPackageJson(context: GenerateContext): PackageJsonShape {
  const basePackageJson: PackageJsonShape = {
    name: context.projectName,
    private: true,
    workspaces: ["packages/*"],
    scripts: {
      prepare: "husky",
      dev: "turbo run dev --filter=./packages/frontend --filter=./packages/backend --parallel",
      build: "turbo run build",
      lint: "bun run format && bunx oxlint",
      typecheck: "bunx tsgo --project tsconfig.json --noEmit && turbo run typecheck",
      format: "bunx oxfmt --write .",
      "format:check": "bunx oxfmt --check .",
      test: "turbo run test",
      "db:generate": "turbo run db:generate",
      "db:migrate": "turbo run db:migrate",
    },
    devDependencies: {
      "@commitlint/cli": "^20.4.4",
      "@commitlint/config-conventional": "^20.4.4",
      "@tanstack/router-plugin": "1.166.7",
      "@testing-library/jest-dom": "^6.9.1",
      "@types/jsdom": "^28.0.0",
      "@types/node": "^25.5.0",
      "@types/react": "19.2.14",
      "@types/react-dom": "19.2.3",
      "@typescript/native-preview": "^7.0.0-dev.20260312.1",
      "@vitest/ui": "4.1.0",
      husky: "9.1.7",
      jsdom: "^28.1.0",
      "lint-staged": "16.3.3",
      oxfmt: "^0.40.0",
      oxlint: "1.55.0",
      tailwindcss: "4.2.1",
      turbo: "^2.8.16",
      vite: "^8.0.0",
      vitest: "4.1.0",
    },
    "lint-staged": {
      "*.{js,jsx,ts,tsx}": ["oxfmt", "oxlint"],
      "*.{css,scss,html,json,jsonc,yaml,yml,md,markdown}": ["oxfmt"],
    },
    engines: {
      node: ">=22.0.0 <25",
    },
    packageManager: "bun@1.3.4",
  };

  const fragments = context.resolvedModules.map(moduleName => ({
    scripts: MODULE_REGISTRY[moduleName].root?.scripts,
    dependencies: MODULE_REGISTRY[moduleName].root?.dependencies,
    devDependencies: MODULE_REGISTRY[moduleName].root?.devDependencies,
  }));

  return mergePackageJson(basePackageJson, ...fragments);
}

function buildFrontendPackageJson(context: GenerateContext): PackageJsonShape {
  const basePackageJson: PackageJsonShape = {
    name: "frontend",
    private: true,
    type: "module",
    scripts: {
      dev: "vite --port 5173",
      build: "vite build && bunx tsgo --noEmit",
      preview: "vite preview",
      test: "bunx vitest run",
      typecheck: "bunx tsgo --noEmit",
    },
    dependencies: {
      "@base-ui/react": "^1.3.0",
      "@fontsource-variable/geist": "^5.2.8",
      "@fontsource/bricolage-grotesque": "^5.2.10",
      "@hookform/resolvers": "^5.2.2",
      "@tabler/icons-react": "^3.40.0",
      "@tailwindcss/vite": "^4.2.1",
      "@tanstack/react-query": "^5.90.21",
      "@tanstack/react-query-devtools": "^5.91.3",
      "@tanstack/react-router": "^1.166.7",
      "@tanstack/react-router-devtools": "^1.166.7",
      "class-variance-authority": "^0.7.1",
      clsx: "^2.1.1",
      cmdk: "^1.1.1",
      "date-fns": "^4.1.0",
      "embla-carousel-react": "^8.6.0",
      "input-otp": "^1.4.2",
      "lucide-react": "^0.577.0",
      "next-themes": "^0.4.6",
      react: "^19.2.4",
      "react-day-picker": "^9.14.0",
      "react-dom": "^19.2.4",
      "react-hook-form": "^7.71.2",
      "react-resizable-panels": "^4.7.2",
      recharts: "2.15.4",
      sonner: "^2.0.7",
      "tailwind-merge": "^3.5.0",
      tailwindcss: "^4.2.1",
      "tw-animate-css": "^1.4.0",
      vaul: "^1.1.2",
      zod: "^4.3.6",
      zustand: "^5.0.11",
    },
    devDependencies: {
      "@babel/plugin-syntax-jsx": "^7.28.6",
      "@rolldown/plugin-babel": "^0.2.0",
      "@tanstack/devtools-vite": "^0.5.5",
      "@testing-library/dom": "^10.4.1",
      "@testing-library/react": "^16.3.2",
      "@vitejs/plugin-react": "^6.0.0",
      "babel-plugin-react-compiler": "^1.0.0",
      "web-vitals": "^5.1.0",
    },
  };

  const fragments = context.resolvedModules.map(moduleName => ({
    scripts: MODULE_REGISTRY[moduleName].frontend?.scripts,
    dependencies: MODULE_REGISTRY[moduleName].frontend?.dependencies,
    devDependencies: MODULE_REGISTRY[moduleName].frontend?.devDependencies,
  }));

  return mergePackageJson(basePackageJson, ...fragments);
}

function buildBackendPackageJson(context: GenerateContext): PackageJsonShape {
  const basePackageJson: PackageJsonShape = {
    name: "backend",
    type: "module",
    scripts: {
      dev: "bun --watch src/index.ts",
      build: "bun build src/index.ts --outdir dist --target bun",
      start: "bun dist/index.js",
      test: "bunx vitest run --config vitest.config.ts",
      "test:watch": "bunx vitest --config vitest.config.ts",
      typecheck: "bunx tsgo --noEmit",
      "db:generate": "bunx drizzle-kit generate",
      "db:migrate": "bunx drizzle-kit migrate",
    },
    dependencies: {
      "@hono/zod-openapi": "^1.2.2",
      "@hono/zod-validator": "^0.7.6",
      "@logtape/logtape": "^2.0.4",
      "@opentelemetry/api": "^1.9.0",
      "@scalar/hono-api-reference": "^0.10.2",
      "drizzle-orm": "^0.45.1",
      "es-toolkit": "^1.45.1",
      hono: "^4.12.7",
      postgres: "^3.4.8",
      "prom-client": "^15.1.3",
      uuid: "^13.0.0",
      zod: "^4.3.6",
    },
    devDependencies: {
      "@types/bun": "^1.3.10",
      "@types/node": "^25.5.0",
      dotenv: "^17.3.1",
      "drizzle-kit": "^0.31.9",
      tsx: "^4.7.1",
      vitest: "4.1.0",
    },
  };

  const fragments = context.resolvedModules.map(moduleName => ({
    scripts: MODULE_REGISTRY[moduleName].backend?.scripts,
    dependencies: MODULE_REGISTRY[moduleName].backend?.dependencies,
    devDependencies: MODULE_REGISTRY[moduleName].backend?.devDependencies,
  }));

  return mergePackageJson(basePackageJson, ...fragments);
}

function buildTurboConfig(context: GenerateContext) {
  const tasks: Record<string, Record<string, unknown>> = {
    build: {
      dependsOn: ["^build"],
      outputs: ["dist/**"],
    },
    dev: {
      cache: false,
      persistent: true,
    },
    lint: {
      dependsOn: ["^lint"],
    },
    typecheck: {
      dependsOn: ["^typecheck"],
    },
    test: {
      cache: false,
    },
    "db:generate": {
      cache: false,
    },
    "db:migrate": {
      cache: false,
    },
  };

  if (context.resolvedModules.includes("storybook")) {
    tasks.storybook = {
      cache: false,
      persistent: true,
    };
    tasks["build-storybook"] = {
      dependsOn: ["^build"],
      outputs: ["storybook-static/**"],
    };
  }

  return { $schema: "https://turbo.build/schema.json", tasks };
}

function buildOxlintConfig(projectName: string) {
  return toJson({
    $schema: "./node_modules/oxlint/configuration_schema.json",
    plugins: ["unicorn", "typescript", "oxc"],
    jsPlugins: [
      "./lint-plugins/react-component-complexity.mjs",
      "./lint-plugins/react-hooks-separation.mjs",
      "./lint-plugins/test-file-location.mjs",
    ],
    rules: {
      "no-unused-vars": "error",
      "no-unused-private-class-members": "error",
      "unicorn/no-empty-file": "warn",
    },
    overrides: [
      {
        files: ["packages/frontend/src/**/*.tsx"],
        rules: {
          [`${projectName}-react/max-component-complexity`]: [
            "error",
            {
              maxHooks: 5,
              maxHandlers: 3,
              maxTotal: 7,
            },
          ],
          [`${projectName}-react-hooks/no-mixed-hooks-and-components`]: "warn",
        },
      },
      {
        files: ["packages/frontend/src/**/*.{ts,tsx}"],
        rules: {
          [`${projectName}-react-hooks/hooks-in-hooks-folder`]: "warn",
        },
      },
      {
        files: ["packages/frontend/src/components/ui/**/*.{ts,tsx}"],
        rules: {
          [`${projectName}-react/max-component-complexity`]: "off",
          [`${projectName}-react-hooks/no-mixed-hooks-and-components`]: "off",
          [`${projectName}-react-hooks/hooks-in-hooks-folder`]: "off",
        },
      },
      {
        files: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}", "**/*.stories.{ts,tsx}"],
        rules: {
          [`${projectName}-react/max-component-complexity`]: "off",
          [`${projectName}-react-hooks/no-mixed-hooks-and-components`]: "off",
          [`${projectName}-react-hooks/hooks-in-hooks-folder`]: "off",
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Separated stack CLAUDE.md builder
// ---------------------------------------------------------------------------

const separatedClaudeMdBuilder: ClaudeMdBuilder = {
  buildClaudeMdArchitectureSection(_context: GenerateContext): string {
    return [
      "## Architecture",
      "",
      "**{{projectTitle}}** is a monorepo with two main packages, orchestrated by Turborepo and managed with Bun.",
      "",
      "### Monorepo Structure",
      "",
      "```",
      "packages/",
      "├── frontend/            # React 19 SPA (Vite + TanStack Router)",
      "└── backend/             # Hono API server (Drizzle ORM + PostgreSQL)",
      "```",
      "",
      "### Path Aliases",
      "",
      "- `@/*` maps to `./src/*` in each package (tsconfig paths)",
      "",
      "### Frontend (`packages/frontend`)",
      "",
      "React 19 single-page application with client-side routing.",
      "",
      "```",
      "src/",
      "├── routes/              # TanStack file-based routes",
      "├── components/          # React components (ui/, feature-specific/)",
      "├── hooks/               # Shared React hooks",
      "├── lib/                 # Client utilities",
      "├── stores/              # Zustand stores",
      "├── data/                # Data layer (TanStack Query, collections)",
      "├── styles.css           # Tailwind v4 theme",
      "└── routeTree.gen.ts     # Auto-generated route tree (never edit)",
      "```",
      "",
      "### Backend (`packages/backend`)",
      "",
      "Hono API server following feature-based module architecture.",
      "",
      "```",
      "src/",
      "├── app.ts               # Main Hono app (plugin composition + route mounting)",
      "├── index.ts             # Server startup",
      "├── modules/             # Feature modules (1 Hono instance = 1 controller)",
      "│   └── <feature>/",
      "│       ├── route.ts     # Hono instance with route handlers",
      "│       ├── usecases.ts  # Business logic (pure functions)",
      "│       ├── model.ts     # Zod schemas and types",
      "│       └── repository.ts # Database operations (Drizzle)",
      "├── plugins/             # Cross-cutting concerns (auth, error handling)",
      "├── lib/                 # Shared utilities",
      "├── db/                  # Database layer (Drizzle schema, migrations)",
      "└── types/               # TypeScript type definitions",
      "```",
      "",
      "### Data Flow",
      "",
      "- **Client**: TanStack Query for server state; Zustand for shared client state",
      "- **Server**: Hono route handlers delegate to usecases, which call repositories",
      "- **Database**: PostgreSQL 16 via Drizzle ORM",
      "",
      "### Tooling",
      "",
      "- **Package manager**: Bun",
      "- **Monorepo orchestration**: Turborepo",
      "- **Linting**: Oxlint",
      "- **Formatting**: Oxfmt (printWidth: 100)",
      "- **Type checking**: tsc",
      "- **Testing**: Vitest + Testing Library",
      "- **Commits**: Conventional Commits + commitlint + husky + lint-staged",
    ].join("\n");
  },
  buildSkillEnforcementBackendSection(_context: GenerateContext): string[] {
    return [
      "- **Hono (routes, middleware, plugins)**: Use `hono` skill",
      "- **Database/schema/queries**: Use `postgres-drizzle` skill",
      "- **Drizzle ORM patterns**: Use `drizzle-orm` skill",
      "- **Drizzle migrations**: Use `drizzle-safe-migrations` skill",
      "- **Validation (Zod schemas)**: Use `zod` skill",
      "- **Utility functions (es-toolkit)**: Use `es-toolkit` skill",
    ];
  },
  buildBackendArchitectureRules(): string {
    return [
      "## Backend Architecture Rules",
      "",
      "- Follow the **1 Hono instance = 1 controller** principle",
      "- Keep route handlers thin — delegate to usecases",
      "- Usecases contain pure business logic (no HTTP context)",
      "- Repositories handle all database operations via Drizzle",
      "- Use Zod validation at API boundaries",
      "- Never edit files in the `drizzle/` folder (auto-generated)",
    ].join("\n");
  },
};

function buildCiWorkflow() {
  const scopes = ["repo", "frontend", "backend", "ui", "auth", "billing", "docs", "test"];

  return [
    "name: CI",
    "",
    "on:",
    "  pull_request:",
    "    branches:",
    "      - main",
    "  push:",
    "    branches:",
    "      - main",
    "",
    "jobs:",
    "  validate-title:",
    "    runs-on: ubuntu-latest",
    "    if: github.event_name == 'pull_request'",
    "    steps:",
    "      - uses: amannn/action-semantic-pull-request@v6",
    "        env:",
    "          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}",
    "        with:",
    "          requireScope: true",
    "          types: |",
    "            build",
    "            ci",
    "            docs",
    "            feat",
    "            fix",
    "            refactor",
    "            test",
    "          scopes: |",
    ...scopes.map(scope => `            ${scope}`),
    "  check:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v5",
    "      - uses: ./.github/actions/setup-bun",
    "      - run: bun install --frozen-lockfile",
    "      - run: make check",
  ].join("\n");
}

function buildFrontendMain() {
  return [
    'import { RouterProvider, createRouter } from "@tanstack/react-router";',
    'import { StrictMode } from "react";',
    'import ReactDOM from "react-dom/client";',
    'import { routeTree } from "./routeTree.gen";',
    'import * as TanStackQueryProvider from "./integrations/tanstack-query/root-provider";',
    'import "./styles.css";',
    "",
    "const TanStackQueryProviderContext = TanStackQueryProvider.getContext();",
    "const router = createRouter({",
    "  routeTree,",
    "  context: {",
    "    ...TanStackQueryProviderContext,",
    "  },",
    '  defaultPreload: "intent",',
    "  scrollRestoration: true,",
    "  defaultStructuralSharing: true,",
    "  defaultPreloadStaleTime: 0,",
    "});",
    "",
    'declare module "@tanstack/react-router" {',
    "  interface Register {",
    "    router: typeof router;",
    "  }",
    "}",
    "",
    'const rootElement = document.getElementById("app");',
    "if (rootElement && !rootElement.innerHTML) {",
    "  const root = ReactDOM.createRoot(rootElement);",
    "  root.render(",
    "    <StrictMode>",
    "      <TanStackQueryProvider.Provider {...TanStackQueryProviderContext}>",
    "        <RouterProvider router={router} />",
    "      </TanStackQueryProvider.Provider>",
    "    </StrictMode>",
    "  );",
    "}",
    "",
  ].join("\n");
}

function buildFrontendIndexHtml(context: GenerateContext) {
  return replaceTemplateTokens(
    [
      "<!doctype html>",
      '<html lang="en">',
      "  <head>",
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      '    <meta name="description" content="{{projectTitle}} full-stack workspace generated by @compozy/devstack" />',
      "    <title>{{projectTitle}}</title>",
      "  </head>",
      "  <body>",
      '    <div id="app"></div>',
      '    <script type="module" src="/src/main.tsx"></script>',
      "  </body>",
      "</html>",
      "",
    ].join("\n"),
    context.tokens
  );
}

function buildFrontendStyles() {
  return [
    '@import "tailwindcss";',
    '@import "tw-animate-css";',
    '@import "shadcn/tailwind.css";',
    '@import "@fontsource-variable/geist";',
    '@import "@fontsource/bricolage-grotesque/500.css";',
    '@import "@fontsource/bricolage-grotesque/700.css";',
    "",
    "@custom-variant dark (&:is(.dark *));",
    "",
    ":root {",
    "  --background: oklch(0.99 0.01 95);",
    "  --foreground: oklch(0.22 0.02 95);",
    "  --card: oklch(0.995 0.008 95);",
    "  --card-foreground: oklch(0.22 0.02 95);",
    "  --popover: oklch(0.995 0.008 95);",
    "  --popover-foreground: oklch(0.22 0.02 95);",
    "  --primary: oklch(0.66 0.16 53);",
    "  --primary-foreground: oklch(0.99 0.01 95);",
    "  --secondary: oklch(0.95 0.01 90);",
    "  --secondary-foreground: oklch(0.28 0.02 95);",
    "  --muted: oklch(0.95 0.01 90);",
    "  --muted-foreground: oklch(0.55 0.02 95);",
    "  --accent: oklch(0.93 0.02 72);",
    "  --accent-foreground: oklch(0.28 0.02 95);",
    "  --destructive: oklch(0.62 0.24 26);",
    "  --border: oklch(0.9 0.01 92);",
    "  --input: oklch(0.9 0.01 92);",
    "  --ring: oklch(0.72 0.04 70);",
    "  --radius: 1rem;",
    "  --sidebar: oklch(0.985 0.01 92);",
    "  --sidebar-foreground: oklch(0.22 0.02 95);",
    "  --sidebar-primary: oklch(0.66 0.16 53);",
    "  --sidebar-primary-foreground: oklch(0.99 0.01 95);",
    "  --sidebar-accent: oklch(0.93 0.02 72);",
    "  --sidebar-accent-foreground: oklch(0.28 0.02 95);",
    "  --sidebar-border: oklch(0.9 0.01 92);",
    "  --sidebar-ring: oklch(0.72 0.04 70);",
    "}",
    "",
    ".dark {",
    "  --background: oklch(0.18 0.01 92);",
    "  --foreground: oklch(0.98 0.01 95);",
    "  --card: oklch(0.22 0.01 92);",
    "  --card-foreground: oklch(0.98 0.01 95);",
    "  --popover: oklch(0.22 0.01 92);",
    "  --popover-foreground: oklch(0.98 0.01 95);",
    "  --primary: oklch(0.72 0.17 62);",
    "  --primary-foreground: oklch(0.19 0.01 92);",
    "  --secondary: oklch(0.28 0.01 92);",
    "  --secondary-foreground: oklch(0.98 0.01 95);",
    "  --muted: oklch(0.28 0.01 92);",
    "  --muted-foreground: oklch(0.72 0.01 95);",
    "  --accent: oklch(0.28 0.02 80);",
    "  --accent-foreground: oklch(0.98 0.01 95);",
    "  --destructive: oklch(0.7 0.19 22);",
    "  --border: oklch(1 0 0 / 10%);",
    "  --input: oklch(1 0 0 / 15%);",
    "  --ring: oklch(0.62 0.04 70);",
    "  --sidebar: oklch(0.18 0.01 92);",
    "  --sidebar-foreground: oklch(0.98 0.01 95);",
    "  --sidebar-primary: oklch(0.72 0.17 62);",
    "  --sidebar-primary-foreground: oklch(0.19 0.01 92);",
    "  --sidebar-accent: oklch(0.28 0.02 80);",
    "  --sidebar-accent-foreground: oklch(0.98 0.01 95);",
    "  --sidebar-border: oklch(1 0 0 / 10%);",
    "  --sidebar-ring: oklch(0.62 0.04 70);",
    "}",
    "",
    "@theme inline {",
    '  --font-sans: "Geist Variable", sans-serif;',
    '  --font-display: "Bricolage Grotesque", sans-serif;',
    "  --color-background: var(--background);",
    "  --color-foreground: var(--foreground);",
    "  --color-card: var(--card);",
    "  --color-card-foreground: var(--card-foreground);",
    "  --color-popover: var(--popover);",
    "  --color-popover-foreground: var(--popover-foreground);",
    "  --color-primary: var(--primary);",
    "  --color-primary-foreground: var(--primary-foreground);",
    "  --color-secondary: var(--secondary);",
    "  --color-secondary-foreground: var(--secondary-foreground);",
    "  --color-muted: var(--muted);",
    "  --color-muted-foreground: var(--muted-foreground);",
    "  --color-accent: var(--accent);",
    "  --color-accent-foreground: var(--accent-foreground);",
    "  --color-destructive: var(--destructive);",
    "  --color-border: var(--border);",
    "  --color-input: var(--input);",
    "  --color-ring: var(--ring);",
    "  --color-sidebar: var(--sidebar);",
    "  --color-sidebar-foreground: var(--sidebar-foreground);",
    "  --color-sidebar-primary: var(--sidebar-primary);",
    "  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);",
    "  --color-sidebar-accent: var(--sidebar-accent);",
    "  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);",
    "  --color-sidebar-border: var(--sidebar-border);",
    "  --color-sidebar-ring: var(--sidebar-ring);",
    "  --radius-sm: calc(var(--radius) - 4px);",
    "  --radius-md: calc(var(--radius) - 2px);",
    "  --radius-lg: var(--radius);",
    "  --radius-xl: calc(var(--radius) + 4px);",
    "}",
    "",
    "@layer base {",
    "  * {",
    "    @apply border-border outline-ring/50;",
    "  }",
    "",
    "  html,",
    "  body,",
    "  #app {",
    "    min-height: 100%;",
    "  }",
    "",
    "  body {",
    "    @apply bg-background font-sans text-foreground antialiased;",
    "    background-image: radial-gradient(circle at top left, color-mix(in oklch, var(--accent) 35%, transparent), transparent 35%),",
    "      linear-gradient(180deg, color-mix(in oklch, var(--background) 96%, black 4%), var(--background));",
    "  }",
    "}",
    "",
  ].join("\n");
}

function buildFrontendThemeStore(context: GenerateContext) {
  return replaceTemplateTokens(
    [
      'import { create } from "zustand";',
      'import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";',
      "",
      'type Theme = "light" | "dark" | "system";',
      "",
      "type ThemeState = {",
      "  theme: Theme;",
      "  setTheme: (theme: Theme) => void;",
      "};",
      "",
      'function getSystemTheme(): "light" | "dark" {',
      '  if (typeof window === "undefined") return "light";',
      '  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";',
      "}",
      "",
      "function applyTheme(theme: Theme) {",
      "  const root = window.document.documentElement;",
      '  root.classList.remove("light", "dark");',
      '  root.classList.add(theme === "system" ? getSystemTheme() : theme);',
      "}",
      "",
      "const noopStorage: StateStorage = {",
      "  getItem: () => null,",
      "  setItem: () => {},",
      "  removeItem: () => {},",
      "};",
      "",
      "function getThemeStorage(): Storage | undefined {",
      '  if (typeof window === "undefined") return undefined;',
      "  return window.localStorage;",
      "}",
      "",
      "export const useThemeStore = create<ThemeState>()(",
      "  persist(",
      "    set => ({",
      '      theme: "system",',
      "      setTheme(theme) {",
      "        applyTheme(theme);",
      "        set({ theme });",
      "      },",
      "    }),",
      "    {",
      '      name: "{{projectName}}-theme",',
      "      storage: createJSONStorage(() => getThemeStorage() ?? noopStorage),",
      "      onRehydrateStorage: () => state => {",
      "        if (state?.theme) {",
      "          applyTheme(state.theme);",
      "        }",
      "      },",
      "    }",
      "  )",
      ");",
      "",
      'if (typeof window !== "undefined") {',
      "  applyTheme(useThemeStore.getState().theme);",
      "}",
      "",
    ].join("\n"),
    context.tokens
  );
}

function buildFrontendSidebar(context: GenerateContext) {
  return replaceTemplateTokens(
    [
      'import type * as React from "react";',
      'import { Link, useRouterState } from "@tanstack/react-router";',
      'import { LayoutDashboardIcon, LifeBuoyIcon, Settings2Icon } from "lucide-react";',
      "import {",
      "  Sidebar,",
      "  SidebarContent,",
      "  SidebarFooter,",
      "  SidebarGroup,",
      "  SidebarGroupContent,",
      "  SidebarHeader,",
      "  SidebarMenu,",
      "  SidebarMenuButton,",
      "  SidebarMenuItem,",
      '} from "@/components/ui/sidebar";',
      "",
      "type NavItem = {",
      "  title: string;",
      "  icon: React.ComponentType<{ className?: string }>;",
      '  to?: "/" | "/settings";',
      "};",
      "",
      "const navItems: NavItem[] = [",
      '  { title: "Overview", to: "/", icon: LayoutDashboardIcon },',
      '  { title: "Settings", to: "/settings", icon: Settings2Icon },',
      "];",
      "",
      "export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {",
      "  const routerState = useRouterState();",
      "  const currentPath = routerState.location.pathname;",
      "",
      "  return (",
      '    <Sidebar collapsible="none" variant="sidebar" className="min-h-svh" {...props}>',
      "      <SidebarHeader>",
      "        <SidebarMenu>",
      "          <SidebarMenuItem>",
      '            <SidebarMenuButton size="lg" render={<Link to="/" />}>',
      '              <div className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">',
      "                {{projectTitle}}".slice(0, 1),
      "              </div>",
      '              <span className="font-display font-semibold">{{projectTitle}}</span>',
      "            </SidebarMenuButton>",
      "          </SidebarMenuItem>",
      "        </SidebarMenu>",
      "      </SidebarHeader>",
      "      <SidebarContent>",
      "        <SidebarGroup>",
      "          <SidebarGroupContent>",
      "            <SidebarMenu>",
      "              {navItems.map(item => {",
      '                const isActive = item.to != null && (item.to === "/" ? currentPath === "/" : currentPath.startsWith(item.to));',
      "                return (",
      "                  <SidebarMenuItem key={item.title}>",
      "                    <SidebarMenuButton tooltip={item.title} isActive={isActive} render={item.to ? <Link to={item.to} /> : undefined}>",
      "                      <item.icon />",
      "                      <span>{item.title}</span>",
      "                    </SidebarMenuButton>",
      "                  </SidebarMenuItem>",
      "                );",
      "              })}",
      "            </SidebarMenu>",
      "          </SidebarGroupContent>",
      "        </SidebarGroup>",
      "      </SidebarContent>",
      "      <SidebarFooter>",
      "        <SidebarMenu>",
      "          <SidebarMenuItem>",
      '            <SidebarMenuButton tooltip="Help">',
      "              <LifeBuoyIcon />",
      "              <span>Help</span>",
      "            </SidebarMenuButton>",
      "          </SidebarMenuItem>",
      "        </SidebarMenu>",
      "      </SidebarFooter>",
      "    </Sidebar>",
      "  );",
      "}",
      "",
    ].join("\n"),
    context.tokens
  ).replace('{{projectTitle}}".slice(0, 1)', context.tokens.projectTitle.slice(0, 1));
}

function buildFrontendDashboardIndex(context: GenerateContext) {
  return replaceTemplateTokens(
    [
      'import { createFileRoute } from "@tanstack/react-router";',
      'import { DashboardTopbar } from "@/components/dashboard-topbar";',
      'import { Button } from "@/components/ui/button";',
      'import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";',
      'import { Surface } from "@/components/ui/surface";',
      "",
      'export const Route = createFileRoute("/_dashboard/")({',
      "  component: DashboardPage,",
      "});",
      "",
      "function DashboardPage() {",
      "  return (",
      "    <>",
      '      <DashboardTopbar title="Overview" />',
      '      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[1.2fr_0.8fr]">',
      "        <Card>",
      "          <CardHeader>",
      '            <CardTitle className="font-display text-3xl">{{projectTitle}}</CardTitle>',
      "            <CardDescription>",
      "              A clean starting point for product teams building with React, Hono and Drizzle.",
      "            </CardDescription>",
      "          </CardHeader>",
      '          <CardContent className="grid gap-4">',
      "            <Surface>",
      '              <div className="text-sm text-muted-foreground">Frontend</div>',
      '              <div className="mt-2 text-xl font-semibold">React 19 + TanStack Router + Query</div>',
      "            </Surface>",
      "            <Surface>",
      '              <div className="text-sm text-muted-foreground">Backend</div>',
      '              <div className="mt-2 text-xl font-semibold">Hono + Drizzle + PostgreSQL</div>',
      "            </Surface>",
      "          </CardContent>",
      "        </Card>",
      "        <Card>",
      "          <CardHeader>",
      "            <CardTitle>Next steps</CardTitle>",
      "            <CardDescription>Use this shell as the first module you replace with your own domain.</CardDescription>",
      "          </CardHeader>",
      '          <CardContent className="grid gap-3">',
      '            <Button asChild><a href="https://hono.dev" target="_blank" rel="noreferrer">Read the Hono docs</a></Button>',
      '            <Button variant="outline" asChild><a href="https://tanstack.com/router" target="_blank" rel="noreferrer">Review the router setup</a></Button>',
      "          </CardContent>",
      "        </Card>",
      "      </div>",
      "    </>",
      "  );",
      "}",
      "",
    ].join("\n"),
    context.tokens
  );
}

function buildFrontendSettings() {
  return [
    'import { createFileRoute } from "@tanstack/react-router";',
    'import { BellRingIcon, PaletteIcon, ShieldCheckIcon } from "lucide-react";',
    'import { DashboardTopbar } from "@/components/dashboard-topbar";',
    'import { Button } from "@/components/ui/button";',
    'import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";',
    'import { Surface } from "@/components/ui/surface";',
    "",
    'export const Route = createFileRoute("/_dashboard/settings")({',
    "  component: SettingsPage,",
    "});",
    "",
    "function SettingsPage() {",
    "  return (",
    "    <>",
    '      <DashboardTopbar title="Settings" />',
    '      <div className="grid flex-1 gap-4 p-4 xl:grid-cols-[1.1fr_0.9fr]">',
    "        <Card>",
    "          <CardHeader>",
    '            <CardTitle className="text-lg">Workspace Preferences</CardTitle>',
    "            <CardDescription>Keep this page generic and replace it with your own product settings.</CardDescription>",
    "          </CardHeader>",
    '          <CardContent className="grid gap-3">',
    "            <Surface>",
    '              <div className="flex items-start justify-between gap-4">',
    '                <div className="flex gap-3">',
    '                  <div className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary"><PaletteIcon className="size-5" /></div>',
    "                  <div>",
    '                    <h3 className="font-display text-base font-semibold tracking-tight">Interface Density</h3>',
    '                    <p className="mt-1 text-sm text-muted-foreground">Tune the shell layout and spacing once your domain model is in place.</p>',
    "                  </div>",
    "                </div>",
    '                <Button variant="outline">Comfortable</Button>',
    "              </div>",
    "            </Surface>",
    "            <Surface>",
    '              <div className="flex items-start justify-between gap-4">',
    '                <div className="flex gap-3">',
    '                  <div className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary"><BellRingIcon className="size-5" /></div>',
    "                  <div>",
    '                    <h3 className="font-display text-base font-semibold tracking-tight">Notifications</h3>',
    '                    <p className="mt-1 text-sm text-muted-foreground">Decide which changes deserve attention before you wire the real event sources.</p>',
    "                  </div>",
    "                </div>",
    "                <Button>Enabled</Button>",
    "              </div>",
    "            </Surface>",
    "            <Surface>",
    '              <div className="flex items-start justify-between gap-4">',
    '                <div className="flex gap-3">',
    '                  <div className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary"><ShieldCheckIcon className="size-5" /></div>',
    "                  <div>",
    '                    <h3 className="font-display text-base font-semibold tracking-tight">Review Gates</h3>',
    '                    <p className="mt-1 text-sm text-muted-foreground">Reserve destructive flows for deliberate confirmations and audit-friendly actions.</p>',
    "                  </div>",
    "                </div>",
    '                <Button variant="outline">Manage</Button>',
    "              </div>",
    "            </Surface>",
    "          </CardContent>",
    "        </Card>",
    "      </div>",
    "    </>",
    "  );",
    "}",
    "",
  ].join("\n");
}

function buildFrontendRouteTree() {
  return [
    "/* eslint-disable */",
    "",
    "// @ts-nocheck",
    "",
    "import { Route as rootRouteImport } from './routes/__root'",
    "import { Route as DashboardRouteImport } from './routes/_dashboard'",
    "import { Route as DashboardIndexRouteImport } from './routes/_dashboard/index'",
    "import { Route as DashboardSettingsRouteImport } from './routes/_dashboard/settings'",
    "",
    "const DashboardRoute = DashboardRouteImport.update({",
    "  id: '/_dashboard',",
    "  getParentRoute: () => rootRouteImport,",
    "} as any)",
    "const DashboardIndexRoute = DashboardIndexRouteImport.update({",
    "  id: '/',",
    "  path: '/',",
    "  getParentRoute: () => DashboardRoute,",
    "} as any)",
    "const DashboardSettingsRoute = DashboardSettingsRouteImport.update({",
    "  id: '/settings',",
    "  path: '/settings',",
    "  getParentRoute: () => DashboardRoute,",
    "} as any)",
    "",
    "export const routeTree = rootRouteImport",
    "  ._addFileChildren({",
    "    DashboardRoute: DashboardRoute._addFileChildren({",
    "      DashboardIndexRoute,",
    "      DashboardSettingsRoute,",
    "    }),",
    "  })",
    "  ._addFileTypes<any>()",
    "",
  ].join("\n");
}

function buildFrontendVitestConfig(context: GenerateContext) {
  return replaceTemplateTokens(
    [
      'import { defineConfig } from "vitest/config";',
      'import viteReact from "@vitejs/plugin-react";',
      'import { fileURLToPath, URL } from "node:url";',
      "",
      "export default defineConfig({",
      "  plugins: [viteReact()],",
      "  resolve: {",
      "    alias: {",
      '      "@": fileURLToPath(new URL("./src", import.meta.url)),',
      "    },",
      "  },",
      "  test: {",
      '    name: "{{projectName}}",',
      '    environment: "jsdom",',
      "    globals: true,",
      '    include: ["src/**/*.{test,spec}.{ts,tsx}"],',
      '    exclude: ["**/node_modules/**", "**/dist/**"],',
      '    setupFiles: ["./src/test-setup.ts"],',
      "  },",
      "});",
      "",
    ].join("\n"),
    context.tokens
  );
}

function buildFrontendAppTest(context: GenerateContext) {
  return replaceTemplateTokens(
    [
      'import { render, screen } from "@testing-library/react";',
      'import App from "./App";',
      "",
      'describe("App", () => {',
      '  it("renders the scaffold shell", async () => {',
      "    render(<App />);",
      '    expect(await screen.findByText("{{projectTitle}}")).toBeInTheDocument();',
      "  });",
      "});",
      "",
    ].join("\n"),
    context.tokens
  );
}

function buildBackendIndex(context: GenerateContext) {
  const lines = [
    'import app from "./app";',
    'import { env } from "./env";',
    'import { logger } from "./lib/logger";',
  ];

  if (context.resolvedModules.includes("observability")) {
    lines.push(
      'import { initializeSentry } from "./lib/sentry";',
      'import { initializeTracing, shutdownTracing } from "./lib/tracing";'
    );
  }

  if (context.resolvedModules.includes("storage")) {
    lines.push('import { initializeStorageBucket } from "./lib/storage";');
  }

  lines.push("", "const port = env.PORT;", "");

  if (context.resolvedModules.includes("observability")) {
    lines.push("initializeSentry();", "await initializeTracing();");
  }

  if (context.resolvedModules.includes("storage")) {
    lines.push("await initializeStorageBucket();");
  }

  lines.push(
    "",
    "const server = Bun.serve({",
    "  port,",
    "  fetch: app.fetch,",
    "});",
    "",
    'logger.info("Server started", {',
    "  port: server.port,",
    "  url: `http://localhost:${server.port}`,",
    "});"
  );

  if (context.resolvedModules.includes("observability")) {
    lines.push(
      "",
      'for (const signal of ["SIGINT", "SIGTERM"] as const) {',
      "  process.on(signal, () => {",
      '    logger.info("Shutting down gracefully", { signal });',
      "    server.stop();",
      "    void shutdownTracing().finally(() => process.exit(0));",
      "  });",
      "}"
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildBackendEnvTs(context: GenerateContext) {
  const lines = [
    'import { mapValues } from "es-toolkit/object";',
    'import { trim } from "es-toolkit/string";',
    'import { z } from "zod";',
    "",
    'const isTest = process.env.NODE_ENV === "test";',
    "const SECRET_KEY_PATTERN = /(SECRET|API_KEY|TOKEN|_KEY|PASSWORD)/i;",
    "",
    "const normalizeOptionalValue = (value: unknown) => {",
    "  if (value === undefined) return undefined;",
    '  if (typeof value === "string") {',
    "    const normalized = trim(value);",
    '    if (normalized === "" || normalized.toLowerCase() === "undefined" || normalized.toLowerCase() === "null") {',
    "      return undefined;",
    "    }",
    "    return normalized;",
    "  }",
    "  return value;",
    "};",
    "",
    "const optionalString = z.preprocess(normalizeOptionalValue, z.string().min(1).optional());",
    "const optionalUrl = z.preprocess(normalizeOptionalValue, z.string().url().optional());",
    "const _optionalBoolean = z.preprocess(value => {",
    "  const normalized = normalizeOptionalValue(value);",
    "  if (normalized === undefined) return undefined;",
    '  if (typeof normalized === "boolean") return normalized;',
    '  if (typeof normalized === "string") {',
    "    switch (normalized.toLowerCase()) {",
    '      case "1":',
    '      case "true":',
    '      case "yes":',
    "        return true;",
    '      case "0":',
    '      case "false":',
    '      case "no":',
    "        return false;",
    "      default:",
    "        return normalized;",
    "    }",
    "  }",
    "  return normalized;",
    "}, z.boolean().optional());",
    "const _optionalPositiveInteger = z.preprocess(normalizeOptionalValue, z.coerce.number().int().positive().optional());",
    "const _requiredSecret = (testDefault: string) => (isTest ? z.string().min(1).default(testDefault) : z.string().min(1));",
    "",
    "const envSchema = z.object({",
    '  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),',
    "  PORT: z.coerce.number().int().positive().default(3000),",
    "  DATABASE_URL: z.string().trim().min(1),",
    "  DATABASE_URL_TEST: optionalString,",
    '  APP_URL: optionalUrl.default("http://localhost:5173"),',
    '  CORS_ORIGIN: optionalString.default("http://localhost:5173"),',
  ];

  if (context.resolvedModules.includes("auth")) {
    lines.push(
      '  BETTER_AUTH_SECRET: _requiredSecret("test-better-auth-secret-0123456789abcdef"),',
      '  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),'
    );
  }

  if (context.resolvedModules.includes("redis")) {
    lines.push(
      '  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),',
      "  RATE_LIMIT_WINDOW_MS: _optionalPositiveInteger,",
      "  RATE_LIMIT_AUTHENTICATED_LIMIT: _optionalPositiveInteger,",
      "  RATE_LIMIT_PUBLIC_LIMIT: _optionalPositiveInteger,",
      "  RATE_LIMIT_WEBHOOK_LIMIT: _optionalPositiveInteger,"
    );
  }

  if (context.resolvedModules.includes("storage")) {
    lines.push(
      "  S3_ENDPOINT: optionalUrl,",
      '  S3_REGION: optionalString.default("sa-east-1"),',
      "  S3_ACCESS_KEY: optionalString,",
      "  S3_SECRET_KEY: optionalString,",
      "  S3_BUCKET: optionalString,"
    );
  }

  if (context.resolvedModules.includes("email")) {
    lines.push(
      "  RESEND_API_KEY: optionalString,",
      "  EMAIL_FROM: optionalString,",
      "  MAILPIT_HOST: optionalString,",
      "  MAILPIT_PORT: _optionalPositiveInteger,"
    );
  }

  if (context.resolvedModules.includes("stripe")) {
    lines.push(
      '  STRIPE_SECRET_KEY: z.preprocess(normalizeOptionalValue, z.string().startsWith("sk_").optional()),',
      '  STRIPE_WEBHOOK_SECRET: z.preprocess(normalizeOptionalValue, z.string().startsWith("whsec_").optional()),',
      "  STRIPE_CHECKOUT_SUCCESS_PATH: optionalString,",
      "  STRIPE_CHECKOUT_CANCEL_PATH: optionalString,"
    );
  }

  if (context.resolvedModules.includes("inngest")) {
    lines.push("  INNGEST_EVENT_KEY: optionalString,", "  INNGEST_SIGNING_KEY: optionalString,");
  }

  if (context.resolvedModules.includes("observability")) {
    lines.push(
      "  SENTRY_DSN: optionalUrl,",
      "  TRACING_ENABLED: _optionalBoolean,",
      "  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,",
      "  OTEL_SERVICE_NAME: optionalString,"
    );
  }

  lines.push(
    "});",
    "",
    "export function loadEnv(rawEnv: Record<string, string | undefined> = process.env) {",
    "  const parsed = envSchema.safeParse(rawEnv);",
    "  if (!parsed.success) {",
    "    throw new Error(`Invalid environment variables:\\n${JSON.stringify(parsed.error.format(), null, 2)}`);",
    "  }",
    "  return parsed.data;",
    "}",
    "",
    "export const env = loadEnv();",
    "export type Env = z.infer<typeof envSchema>;",
    "",
    'const _hasString = (value: string | undefined) => typeof value === "string" && trim(value).length > 0;',
    "",
    "export const featureAvailability = {"
  );

  const features = [
    `auth: ${context.resolvedModules.includes("auth") ? "_hasString(env.BETTER_AUTH_SECRET)" : "false"}`,
    `organizations: ${context.resolvedModules.includes("organizations") ? "_hasString(env.BETTER_AUTH_SECRET)" : "false"}`,
    `redis: ${context.resolvedModules.includes("redis") ? "_hasString(env.REDIS_URL)" : "false"}`,
    `storage: ${context.resolvedModules.includes("storage") ? "_hasString(env.S3_BUCKET)" : "false"}`,
    `email: ${context.resolvedModules.includes("email") ? "_hasString(env.EMAIL_FROM) || _hasString(env.RESEND_API_KEY)" : "false"}`,
    `stripe: ${context.resolvedModules.includes("stripe") ? "_hasString(env.STRIPE_SECRET_KEY) && _hasString(env.STRIPE_WEBHOOK_SECRET)" : "false"}`,
    `inngest: ${context.resolvedModules.includes("inngest") ? "_hasString(env.INNGEST_SIGNING_KEY) || _hasString(env.INNGEST_EVENT_KEY)" : "false"}`,
    `observability: ${context.resolvedModules.includes("observability") ? "_hasString(env.SENTRY_DSN) || Boolean(env.TRACING_ENABLED)" : "false"}`,
  ];

  lines.push(...features.map(item => `  ${item},`));
  lines.push(
    "} as const;",
    "",
    "function redactEnvValue(key: string, value: unknown) {",
    '  if (key === "DATABASE_URL" || key === "DATABASE_URL_TEST") return "[REDACTED]";',
    '  return SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : value;',
    "}",
    "",
    "export const redactedEnv = mapValues(env, (value, key) => redactEnvValue(key, value));",
    ""
  );

  return `${lines.join("\n")}\n`;
}

function buildBackendEnvExample(context: GenerateContext) {
  const sections = [
    "# Server",
    "PORT=3000",
    "NODE_ENV=development",
    "",
    "# Database",
    `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${context.projectName}?schema=public`,
    `DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/${context.projectName}_test?schema=public`,
    "",
    "# Frontend",
    "APP_URL=http://localhost:5173",
    "CORS_ORIGIN=http://localhost:5173",
  ];

  for (const moduleName of context.resolvedModules) {
    const envVars = MODULE_REGISTRY[moduleName].envVars;
    if (!envVars?.length) {
      continue;
    }

    sections.push("", `# ${MODULE_REGISTRY[moduleName].label}`);
    for (const envVar of envVars) {
      sections.push(replaceTemplateTokens(`${envVar.key}=${envVar.value}`, context.tokens));
    }
  }

  return `${sections.join("\n")}\n`;
}

function buildBackendItemsSchema() {
  return [
    'import { pgTable, text, timestamp } from "drizzle-orm/pg-core";',
    'import { generateId } from "../../lib/id";',
    "",
    'export const items = pgTable("items", {',
    '  id: text("id").primaryKey().$defaultFn(() => generateId()),',
    '  name: text("name").notNull(),',
    '  description: text("description"),',
    '  created_at: timestamp("created_at").defaultNow().notNull(),',
    '  updated_at: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),',
    "});",
    "",
    "export type Item = typeof items.$inferSelect;",
    "export type NewItem = typeof items.$inferInsert;",
    "",
  ].join("\n");
}

function buildBackendSchemaIndex(context: GenerateContext) {
  const exports = ['export * from "./items";'];
  if (context.resolvedModules.includes("auth")) exports.push('export * from "./auth";');
  if (context.resolvedModules.includes("stripe")) exports.push('export * from "./billing";');
  return `${exports.join("\n")}\n`;
}

function buildBackendTypesIndex(context: GenerateContext) {
  if (!context.resolvedModules.includes("auth")) {
    return "export {};\n";
  }

  return ['export type { AuthSession, AuthUser } from "../plugins/auth";', ""].join("\n");
}

function buildBackendPluginsIndex(context: GenerateContext) {
  const lines = [
    'export { errorHandler } from "./error";',
    'export { loggingMiddleware } from "./logging";',
    'export { metricsMiddleware, metricsRoutes } from "./metrics";',
    'export { openApiRoutes } from "./openapi";',
    'export { REQUEST_ID_HEADER, requestIdMiddleware } from "./request-id";',
    'export type { RequestIdVariables } from "./request-id";',
  ];

  if (context.resolvedModules.includes("auth")) {
    lines.push(
      'export { auth, authHandler, requireAuth, requireSuperadmin, sessionMiddleware } from "./auth";',
      'export type { AuthSession, AuthUser, AuthVariables } from "./auth";'
    );
  }

  if (context.resolvedModules.includes("organizations")) {
    lines.push('export { requireActiveOrg } from "./auth";');
  }

  if (context.resolvedModules.includes("redis")) {
    lines.push(
      'export { authenticatedRateLimit, publicRateLimit, webhookRateLimit } from "./rate-limiter";',
      'export type { RateLimitVariables } from "./rate-limiter";'
    );
  }

  if (context.resolvedModules.includes("observability")) {
    lines.push(
      'export { tracingMiddleware } from "../lib/tracing";',
      'export type { TracingVariables } from "../lib/tracing";'
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildBackendHealthRoute(context: GenerateContext) {
  const imports = [
    'import { sql } from "drizzle-orm";',
    'import { Hono } from "hono";',
    'import { db } from "../db/index";',
  ];

  const checks = [
    "  try {",
    "    await db.execute(sql`select 1`);",
    "  } catch {",
    '    return c.json({ status: "not_ready", checks: { postgres: "error" } }, 503);',
    "  }",
  ];

  if (context.resolvedModules.includes("redis")) {
    imports.push('import { getRedisClient } from "../lib/redis";');
    checks.push(
      "  try {",
      "    const pong = await getRedisClient().ping();",
      '    if (pong !== "PONG") throw new Error("Redis did not respond with PONG");',
      "  } catch {",
      '    return c.json({ status: "not_ready", checks: { postgres: "ok", redis: "error" } }, 503);',
      "  }"
    );
  }

  return [
    ...imports,
    "",
    "const healthRoutes = new Hono();",
    "",
    'healthRoutes.get("/", c => {',
    '  return c.json({ status: "ok", timestamp: new Date().toISOString() });',
    "});",
    "",
    'healthRoutes.get("/ready", async c => {',
    ...checks,
    '  return c.json({ status: "ready", timestamp: new Date().toISOString() });',
    "});",
    "",
    "export { healthRoutes };",
    "",
  ].join("\n");
}

function buildBackendItemsModel() {
  return [
    'import { z } from "zod";',
    "",
    "export const itemSchema = z.object({",
    "  id: z.string().trim().min(1),",
    "  name: z.string().trim().min(1),",
    "  description: z.string().trim().min(1).nullable().optional(),",
    "});",
    "",
    "export const createItemSchema = itemSchema.omit({ id: true });",
    "export const updateItemSchema = createItemSchema.partial();",
    "",
    "export type ItemDto = z.infer<typeof itemSchema>;",
    "export type CreateItemInput = z.infer<typeof createItemSchema>;",
    "export type UpdateItemInput = z.infer<typeof updateItemSchema>;",
    "",
  ].join("\n");
}

function buildBackendItemsRepository() {
  return [
    'import { eq } from "drizzle-orm";',
    'import { db, type Database } from "../../db";',
    'import { items, type NewItem } from "../../db/schema";',
    "",
    'type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];',
    "type DatabaseClient = Database | Transaction;",
    "",
    "export function listItems(database: DatabaseClient = db) {",
    "  return database.select().from(items);",
    "}",
    "",
    "export async function findItemById(id: string, database: DatabaseClient = db) {",
    "  const [record] = await database.select().from(items).where(eq(items.id, id)).limit(1);",
    "  return record ?? null;",
    "}",
    "",
    "export async function createItem(data: NewItem, database: DatabaseClient = db) {",
    "  const [record] = await database.insert(items).values(data).returning();",
    '  if (!record) throw new Error("Failed to create item");',
    "  return record;",
    "}",
    "",
    "export async function updateItem(id: string, data: Partial<NewItem>, database: DatabaseClient = db) {",
    "  const [record] = await database.update(items).set(data).where(eq(items.id, id)).returning();",
    "  return record ?? null;",
    "}",
    "",
    "export async function deleteItem(id: string, database: DatabaseClient = db) {",
    "  const [record] = await database.delete(items).where(eq(items.id, id)).returning();",
    "  return record ?? null;",
    "}",
    "",
  ].join("\n");
}

function buildBackendItemsUsecases() {
  return [
    'import { NotFoundError } from "../../lib/errors";',
    'import type { CreateItemInput, UpdateItemInput } from "./model";',
    'import * as repository from "./repository";',
    "",
    "export function listItems() {",
    "  return repository.listItems();",
    "}",
    "",
    "export async function getItem(id: string) {",
    "  const item = await repository.findItemById(id);",
    '  if (!item) throw new NotFoundError("Item");',
    "  return item;",
    "}",
    "",
    "export function createItem(input: CreateItemInput) {",
    "  return repository.createItem(input);",
    "}",
    "",
    "export async function updateItem(id: string, input: UpdateItemInput) {",
    "  const item = await repository.updateItem(id, input);",
    '  if (!item) throw new NotFoundError("Item");',
    "  return item;",
    "}",
    "",
    "export async function deleteItem(id: string) {",
    "  const item = await repository.deleteItem(id);",
    '  if (!item) throw new NotFoundError("Item");',
    "  return item;",
    "}",
    "",
  ].join("\n");
}

function buildBackendItemsRoute() {
  return [
    'import { zValidator } from "@hono/zod-validator";',
    'import { Hono } from "hono";',
    'import { created, ok } from "../../lib/response";',
    'import { createItemSchema, updateItemSchema } from "./model";',
    'import * as usecases from "./usecases";',
    "",
    "export const itemsModule = new Hono()",
    '  .get("/", async c => c.json(ok(await usecases.listItems())))',
    '  .post("/", zValidator("json", createItemSchema), async c => c.json(created(await usecases.createItem(c.req.valid("json"))), 201))',
    '  .get("/:id", async c => c.json(ok(await usecases.getItem(c.req.param("id")))))',
    '  .patch("/:id", zValidator("json", updateItemSchema), async c => c.json(ok(await usecases.updateItem(c.req.param("id"), c.req.valid("json")))))',
    '  .delete("/:id", async c => c.json(ok(await usecases.deleteItem(c.req.param("id")))));',
    "",
  ].join("\n");
}

function buildBackendItemsIndex() {
  return 'export { itemsModule } from "./route";\n';
}

function buildBackendApp(context: GenerateContext) {
  const imports = [
    'import { cors } from "hono/cors";',
    'import { env } from "./env";',
    'import { createOpenApiApp } from "./lib/openapi";',
    'import { configureBackendLogger } from "./lib/logger";',
    'import { itemsModule } from "./modules/items";',
    "import {",
    "  errorHandler,",
    "  loggingMiddleware,",
    "  metricsMiddleware,",
    "  metricsRoutes,",
    "  openApiRoutes,",
    "  requestIdMiddleware,",
    "  REQUEST_ID_HEADER,",
    "  type RequestIdVariables,",
    '} from "./plugins";',
    'import { healthRoutes } from "./routes/health";',
  ];

  const appVariables: string[] = ["RequestIdVariables"];

  if (context.resolvedModules.includes("auth")) {
    imports.push(
      'import { authHandler, requireAuth, sessionMiddleware, type AuthVariables } from "./plugins";'
    );
    appVariables.push("AuthVariables");
  }

  if (context.resolvedModules.includes("organizations")) {
    imports.push('import { requireActiveOrg } from "./plugins";');
  }

  if (context.resolvedModules.includes("redis")) {
    imports.push(
      'import { authenticatedRateLimit, publicRateLimit, webhookRateLimit, type RateLimitVariables } from "./plugins";'
    );
    appVariables.push("RateLimitVariables");
  }

  if (context.resolvedModules.includes("observability")) {
    imports.push('import { tracingMiddleware, type TracingVariables } from "./plugins";');
    appVariables.push("TracingVariables");
  }

  if (context.resolvedModules.includes("stripe")) {
    imports.push('import { stripeWebhooksRoutes } from "./routes/webhooks";');
    imports.push('import { billingModule } from "./modules/billing";');
  }

  if (context.resolvedModules.includes("inngest")) {
    imports.push('import { inngestServeHandler } from "./lib/inngest";');
  }

  const lines = [
    ...imports,
    "",
    "configureBackendLogger();",
    "",
    `type AppVariables = ${appVariables.join(" & ")};`,
    "",
    "const app = createOpenApiApp<{ Variables: AppVariables }>();",
    "const apiRoutes = createOpenApiApp<{ Variables: AppVariables }>();",
    "",
    "app.onError(errorHandler);",
    'app.use("*", requestIdMiddleware);',
  ];

  if (context.resolvedModules.includes("observability")) {
    lines.push('app.use("*", tracingMiddleware);');
  }

  lines.push(
    'app.use("*", metricsMiddleware);',
    'app.use("*", loggingMiddleware);',
    "app.use(",
    '  "*",',
    "  cors({",
    "    origin: env.CORS_ORIGIN,",
    '    allowHeaders: ["Content-Type", "Authorization", "X-Organization-Id", REQUEST_ID_HEADER],',
    '    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],',
    "    credentials: true,",
    "    exposeHeaders: [REQUEST_ID_HEADER],",
    "  })",
    ");",
    "",
    'app.doc31("/openapi.json", {',
    '  openapi: "3.1.0",',
    "  info: {",
    `    title: "${context.tokens.projectTitle} API",`,
    '    version: "1.0.0",',
    `    description: "${context.tokens.projectTitle} REST API",`,
    "  },",
    '  servers: [{ url: env.APP_URL, description: "Application" }],',
    "});",
    'app.route("/", openApiRoutes);',
    'app.route("/metrics", metricsRoutes);',
    'app.route("/health", healthRoutes);'
  );

  if (context.resolvedModules.includes("stripe")) {
    if (context.resolvedModules.includes("redis")) {
      lines.push('app.use("/api/webhooks/*", webhookRateLimit);');
    }
    lines.push('app.route("/api/webhooks", stripeWebhooksRoutes);');
  }

  if (context.resolvedModules.includes("inngest")) {
    lines.push('app.on(["GET", "POST"], "/api/inngest", inngestServeHandler);');
  }

  if (context.resolvedModules.includes("auth")) {
    if (context.resolvedModules.includes("redis")) {
      lines.push('app.use("/api/auth/*", publicRateLimit);');
    }
    lines.push('app.on(["GET", "POST"], "/api/auth/*", authHandler);');
    lines.push('apiRoutes.use("*", sessionMiddleware);');
    if (context.resolvedModules.includes("redis")) {
      lines.push('apiRoutes.use("*", authenticatedRateLimit);');
    }
    lines.push('apiRoutes.use("*", requireAuth);');
    if (context.resolvedModules.includes("organizations")) {
      lines.push('apiRoutes.use("*", requireActiveOrg);');
    }
  } else if (context.resolvedModules.includes("redis")) {
    lines.push('apiRoutes.use("*", publicRateLimit);');
  }

  lines.push('apiRoutes.route("/items", itemsModule);');

  if (context.resolvedModules.includes("stripe")) {
    lines.push('apiRoutes.route("/billing", billingModule);');
  }

  lines.push('app.route("/api/v1", apiRoutes);', "", "export default app;", "");
  return lines.join("\n");
}

function buildAuthPlugin(context: GenerateContext) {
  const requireActiveOrg = context.resolvedModules.includes("organizations")
    ? [
        "",
        "export const requireActiveOrg = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {",
        '  const session = c.get("session");',
        "  const activeOrganizationId = session?.activeOrganizationId ?? null;",
        "  if (!activeOrganizationId) {",
        '    throw new ForbiddenError("No active organization");',
        "  }",
        '  c.set("orgId", activeOrganizationId);',
        "  await next();",
        "});",
      ].join("\n")
    : "";

  return [
    'import { createMiddleware } from "hono/factory";',
    'import { auth } from "../lib/auth/auth";',
    'import { ForbiddenError, UnauthorizedError } from "../lib/errors";',
    "",
    "export type AuthUser = typeof auth.$Infer.Session.user;",
    "export type AuthSession = typeof auth.$Infer.Session.session;",
    "export type AuthVariables = {",
    "  orgId: string | null;",
    "  session: AuthSession | null;",
    "  user: AuthUser | null;",
    "};",
    "",
    "export const sessionMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {",
    "  const session = await auth.api.getSession({ headers: c.req.raw.headers });",
    "  if (!session) {",
    '    c.set("user", null);',
    '    c.set("session", null);',
    '    c.set("orgId", null);',
    "    await next();",
    "    return;",
    "  }",
    '  c.set("user", session.user);',
    '  c.set("session", session.session);',
    '  c.set("orgId", session.session.activeOrganizationId ?? null);',
    "  await next();",
    "});",
    "",
    "export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {",
    '  if (!c.get("user")) {',
    "    throw new UnauthorizedError();",
    "  }",
    "  await next();",
    "});",
    requireActiveOrg,
    "",
    "export const requireSuperadmin = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {",
    '  if (c.get("user")?.role !== "superadmin") {',
    "    throw new ForbiddenError();",
    "  }",
    "  await next();",
    "});",
    "",
    "export const authHandler = (c: { req: { raw: Request } }) => auth.handler(c.req.raw);",
    "export { auth };",
    "",
  ].join("\n");
}

function buildAuthConfig(context: GenerateContext) {
  const pluginImports = context.resolvedModules.includes("organizations")
    ? 'import { admin, organization } from "better-auth/plugins";'
    : 'import { admin } from "better-auth/plugins";';

  const orgPluginBlock = context.resolvedModules.includes("organizations")
    ? [
        "    organization({",
        "      allowUserToCreateOrganization: true,",
        "      schema: {",
        '        session: { fields: { activeOrganizationId: "active_organization_id" } },',
        '        organization: { fields: { createdAt: "created_at", updatedAt: "updated_at" } },',
        '        member: { fields: { organizationId: "organization_id", userId: "user_id", createdAt: "created_at" } },',
        '        invitation: { fields: { organizationId: "organization_id", inviterId: "inviter_id", expiresAt: "expires_at", createdAt: "created_at" } },',
        "      },",
        "    }),",
      ].join("\n")
    : "";

  const schemaEntries = [
    "      user: schema.user,",
    "      session: schema.session,",
    "      account: schema.account,",
    "      verification: schema.verification,",
  ];
  if (context.resolvedModules.includes("organizations")) {
    schemaEntries.push(
      "      organization: schema.organization,",
      "      member: schema.member,",
      "      invitation: schema.invitation,"
    );
  }

  return replaceTemplateTokens(
    [
      'import { betterAuth } from "better-auth";',
      'import { drizzleAdapter } from "better-auth/adapters/drizzle";',
      pluginImports,
      'import { db } from "../../db";',
      'import { env } from "../../env";',
      'import * as schema from "../../db/schema";',
      'import { generateId } from "../id";',
      "",
      'const trustedOrigins = [env.BETTER_AUTH_URL, ...env.CORS_ORIGIN.split(",").map(origin => origin.trim())].filter(Boolean);',
      "",
      "export const auth = betterAuth({",
      "  secret: env.BETTER_AUTH_SECRET,",
      "  baseURL: env.BETTER_AUTH_URL,",
      "  trustedOrigins,",
      "  database: drizzleAdapter(db, {",
      '    provider: "pg",',
      "    schema: {",
      ...schemaEntries,
      "    },",
      "  }),",
      "  emailAndPassword: {",
      "    enabled: true,",
      "    minPasswordLength: 8,",
      "    maxPasswordLength: 128,",
      "  },",
      "  advanced: {",
      "    database: {",
      "      generateId: () => generateId(),",
      "    },",
      '    cookiePrefix: "{{projectName}}",',
      '    useSecureCookies: env.NODE_ENV === "production",',
      "  },",
      "  session: {",
      "    cookieCache: { enabled: true, maxAge: 60 * 5 },",
      "    expiresIn: 60 * 60 * 24 * 7,",
      "    updateAge: 60 * 60 * 24,",
      "    fields: {",
      '      userId: "user_id",',
      '      expiresAt: "expires_at",',
      '      ipAddress: "ip_address",',
      '      userAgent: "user_agent",',
      '      activeOrganizationId: "active_organization_id",',
      '      impersonatedBy: "impersonated_by",',
      '      createdAt: "created_at",',
      '      updatedAt: "updated_at",',
      "    },",
      "  },",
      '  user: { fields: { emailVerified: "email_verified", createdAt: "created_at", updatedAt: "updated_at" } },',
      '  account: { fields: { userId: "user_id", accountId: "account_id", providerId: "provider_id", accessToken: "access_token", refreshToken: "refresh_token", idToken: "id_token", accessTokenExpiresAt: "access_token_expires_at", refreshTokenExpiresAt: "refresh_token_expires_at", createdAt: "created_at", updatedAt: "updated_at" } },',
      '  verification: { fields: { expiresAt: "expires_at", createdAt: "created_at", updatedAt: "updated_at" } },',
      "  plugins: [",
      orgPluginBlock,
      "    admin({",
      '      adminRoles: ["superadmin"],',
      "      schema: {",
      '        user: { fields: { banReason: "ban_reason", banExpires: "ban_expires" } },',
      '        session: { fields: { impersonatedBy: "impersonated_by" } },',
      "      },",
      "    }),",
      "  ],",
      "});",
      "",
      "export type Auth = typeof auth;",
      "",
    ].join("\n"),
    context.tokens
  );
}

function buildAuthContext() {
  return [
    'import type { Context } from "hono";',
    'import { auth } from "./auth";',
    "",
    "export type AuthUser = typeof auth.$Infer.Session.user;",
    "export type AuthSession = typeof auth.$Infer.Session.session;",
    "",
    "export async function getAuthContext(c: Context) {",
    "  const session = await auth.api.getSession({ headers: c.req.raw.headers });",
    "  if (!session) {",
    "    return { user: null, session: null, activeOrganizationId: null };",
    "  }",
    "  return {",
    "    user: session.user,",
    "    session: session.session,",
    "    activeOrganizationId: session.session.activeOrganizationId ?? null,",
    "  };",
    "}",
    "",
  ].join("\n");
}

function buildAuthSchema(context: GenerateContext) {
  const basic = [
    'import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";',
    'import { generateId } from "../../lib/id";',
    "",
    'export const user = pgTable("user", {',
    '  id: text("id").primaryKey(),',
    '  name: text("name").notNull(),',
    '  email: text("email").notNull().unique(),',
    '  email_verified: boolean("email_verified").default(false).notNull(),',
    '  image: text("image"),',
    '  role: text("role"),',
    '  banned: boolean("banned").default(false).notNull(),',
    '  ban_reason: text("ban_reason"),',
    '  ban_expires: timestamp("ban_expires"),',
    '  created_at: timestamp("created_at").defaultNow().notNull(),',
    '  updated_at: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),',
    "});",
    "",
    context.resolvedModules.includes("organizations")
      ? 'export const organization = pgTable("organization", { id: text("id").primaryKey().$defaultFn(() => generateId()), name: text("name").notNull(), slug: text("slug").notNull().unique(), logo: text("logo"), metadata: jsonb("metadata").$type<Record<string, unknown>>(), created_at: timestamp("created_at").defaultNow().notNull(), updated_at: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()) });'
      : "",
    "",
    'export const session = pgTable("session", {',
    '  id: text("id").primaryKey(),',
    '  expires_at: timestamp("expires_at").notNull(),',
    '  token: text("token").notNull().unique(),',
    '  created_at: timestamp("created_at").defaultNow().notNull(),',
    '  updated_at: timestamp("updated_at").$onUpdate(() => new Date()).notNull(),',
    '  ip_address: text("ip_address"),',
    '  user_agent: text("user_agent"),',
    `  active_organization_id: text("active_organization_id")${context.resolvedModules.includes("organizations") ? '.references(() => organization.id, { onDelete: "set null" })' : ""},`,
    '  impersonated_by: text("impersonated_by").references(() => user.id, { onDelete: "set null" }),',
    '  user_id: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),',
    '}, table => [index("session_user_id_idx").on(table.user_id)]);',
    "",
    'export const account = pgTable("account", {',
    '  id: text("id").primaryKey(),',
    '  account_id: text("account_id").notNull(),',
    '  provider_id: text("provider_id").notNull(),',
    '  user_id: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),',
    '  access_token: text("access_token"),',
    '  refresh_token: text("refresh_token"),',
    '  id_token: text("id_token"),',
    '  access_token_expires_at: timestamp("access_token_expires_at"),',
    '  refresh_token_expires_at: timestamp("refresh_token_expires_at"),',
    '  scope: text("scope"),',
    '  password: text("password"),',
    '  created_at: timestamp("created_at").defaultNow().notNull(),',
    '  updated_at: timestamp("updated_at").$onUpdate(() => new Date()).notNull(),',
    '}, table => [index("account_user_id_idx").on(table.user_id)]);',
    "",
    'export const verification = pgTable("verification", {',
    '  id: text("id").primaryKey(),',
    '  identifier: text("identifier").notNull(),',
    '  value: text("value").notNull(),',
    '  expires_at: timestamp("expires_at").notNull(),',
    '  created_at: timestamp("created_at").defaultNow().notNull(),',
    '  updated_at: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),',
    '}, table => [index("verification_identifier_idx").on(table.identifier)]);',
  ];

  if (!context.resolvedModules.includes("organizations")) {
    return `${basic.join("\n")}\n`;
  }

  return [
    ...basic,
    "",
    'export const member = pgTable("member", {',
    '  id: text("id").primaryKey().$defaultFn(() => generateId()),',
    '  organization_id: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),',
    '  user_id: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),',
    '  role: text("role").notNull(),',
    '  created_at: timestamp("created_at").defaultNow().notNull(),',
    '}, table => [index("member_organization_id_idx").on(table.organization_id), index("member_user_id_idx").on(table.user_id), uniqueIndex("member_org_user_unique").on(table.organization_id, table.user_id)]);',
    "",
    'export const invitation = pgTable("invitation", {',
    '  id: text("id").primaryKey().$defaultFn(() => generateId()),',
    '  organization_id: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),',
    '  email: text("email").notNull(),',
    '  role: text("role").notNull(),',
    '  status: text("status").default("pending").notNull(),',
    '  expires_at: timestamp("expires_at").notNull(),',
    '  inviter_id: text("inviter_id").notNull().references(() => user.id, { onDelete: "cascade" }),',
    '  created_at: timestamp("created_at").defaultNow().notNull(),',
    '}, table => [index("invitation_organization_id_idx").on(table.organization_id), index("invitation_inviter_id_idx").on(table.inviter_id), index("invitation_email_idx").on(table.email)]);',
    "",
  ].join("\n");
}

function buildOrganizationFiles() {
  return {
    "src/lib/auth/org-context.ts": [
      'import type { Context } from "hono";',
      'import { ValidationError } from "../errors";',
      'import type { AuthSession, AuthUser } from "./auth-context";',
      "",
      "type OrgContextVariables = { user: AuthUser | null; session: AuthSession | null };",
      "",
      "export function getOrgId<Variables extends OrgContextVariables>(c: Context<{ Variables: Variables }>) {",
      '  const user = c.get("user");',
      '  const session = c.get("session");',
      '  if (user?.role === "superadmin") {',
      '    const organizationId = c.req.header("x-organization-id");',
      '    if (!organizationId) throw new ValidationError("Superadmin must specify X-Organization-Id");',
      "    return organizationId;",
      "  }",
      "  const activeOrganizationId = session?.activeOrganizationId ?? null;",
      '  if (!activeOrganizationId) throw new ValidationError("No active organization");',
      "  return activeOrganizationId;",
      "}",
      "",
    ].join("\n"),
    "src/lib/auth/permissions.ts": [
      "export const defaultOrganizationRoles = {",
      '  owner: ["organizations:manage", "billing:manage", "items:write", "items:read"],',
      '  admin: ["items:write", "items:read", "billing:read"],',
      '  member: ["items:read"],',
      "} as const;",
      "",
      "export function createAccessControl() {",
      "  return defaultOrganizationRoles;",
      "}",
      "",
    ].join("\n"),
  };
}

function buildStripeFiles(context: GenerateContext) {
  const webhookBody = context.resolvedModules.includes("inngest")
    ? '  await inngest.send({ name: "billing/stripe.webhook.received", data: { eventId: event.id, eventType: event.type, payload: event as unknown as Record<string, unknown> } });'
    : "  void event;";

  const webhookImport = context.resolvedModules.includes("inngest")
    ? 'import { inngest } from "../lib/inngest";'
    : "";

  return {
    "src/lib/integrations/stripe.ts": [
      'import Stripe from "stripe";',
      'import { env } from "../../env";',
      "",
      'const DEFAULT_CHECKOUT_CANCEL_PATH = "/billing";',
      'const DEFAULT_CHECKOUT_SUCCESS_PATH = "/billing/success";',
      "",
      "function trimTrailingSlashes(value: string) {",
      '  return value.replace(/\\/+$/, "");',
      "}",
      "",
      "export class StripeClient {",
      '  constructor(public readonly sdk = new Stripe(env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", { maxNetworkRetries: 2 })) {}',
      "",
      "  buildCheckoutCancelUrl() {",
      "    return `${trimTrailingSlashes(env.APP_URL)}${env.STRIPE_CHECKOUT_CANCEL_PATH ?? DEFAULT_CHECKOUT_CANCEL_PATH}`;",
      "  }",
      "",
      "  buildCheckoutSuccessUrl() {",
      "    return `${trimTrailingSlashes(env.APP_URL)}${env.STRIPE_CHECKOUT_SUCCESS_PATH ?? DEFAULT_CHECKOUT_SUCCESS_PATH}?session_id={CHECKOUT_SESSION_ID}`;",
      "  }",
      "",
      "  constructWebhookEvent(input: { payload: string; signature: string }) {",
      "    if (!env.STRIPE_WEBHOOK_SECRET) {",
      '      throw new Error("Stripe webhook secret is missing");',
      "    }",
      "    return this.sdk.webhooks.constructEvent(input.payload, input.signature, env.STRIPE_WEBHOOK_SECRET);",
      "  }",
      "",
      "  createCheckoutSession(input: { customerId: string; planId: string; planSlug: string; priceId: string }) {",
      "    return this.sdk.checkout.sessions.create({",
      '      mode: "subscription",',
      "      customer: input.customerId,",
      "      line_items: [{ price: input.priceId, quantity: 1 }],",
      "      metadata: { plan_id: input.planId, plan_slug: input.planSlug },",
      "      subscription_data: { metadata: { plan_id: input.planId, plan_slug: input.planSlug } },",
      "      success_url: this.buildCheckoutSuccessUrl(),",
      "      cancel_url: this.buildCheckoutCancelUrl(),",
      "    });",
      "  }",
      "}",
      "",
      "export const stripeClient = new StripeClient();",
      "",
    ].join("\n"),
    "src/lib/billing.ts": [
      'import { db, type Database } from "../db";',
      'import type { BillingFeature } from "../db/schema";',
      'import * as billingRepository from "../modules/billing/repository";',
      "",
      'type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];',
      "type DatabaseClient = Database | Transaction;",
      "",
      "export async function hasFeature(organizationId: string, feature: BillingFeature, database: DatabaseClient = db) {",
      "  const value = await billingRepository.getFeatureValueForOrganization(database, organizationId, feature);",
      "  if (!value) return false;",
      '  return value.value_type === "boolean" ? value.value_boolean ?? false : (value.value_integer ?? 0) !== 0;',
      "}",
      "",
      "export async function getFeatureLimit(organizationId: string, feature: BillingFeature, database: DatabaseClient = db) {",
      "  const value = await billingRepository.getFeatureValueForOrganization(database, organizationId, feature);",
      '  if (!value || value.value_type !== "integer") return 0;',
      "  return value.value_integer ?? 0;",
      "}",
      "",
    ].join("\n"),
    "src/routes/webhooks.ts": [
      'import { Hono } from "hono";',
      webhookImport,
      'import { stripeClient } from "../lib/integrations/stripe";',
      "",
      "export const stripeWebhooksRoutes = new Hono();",
      "",
      'stripeWebhooksRoutes.post("/stripe", async c => {',
      "  const rawBody = await c.req.text();",
      '  const signature = c.req.header("stripe-signature");',
      "  if (!signature) {",
      '    return c.json({ error: "Invalid webhook signature" }, 400);',
      "  }",
      "  let event;",
      "  try {",
      "    event = stripeClient.constructWebhookEvent({ payload: rawBody, signature });",
      "  } catch {",
      '    return c.json({ error: "Invalid webhook signature" }, 400);',
      "  }",
      webhookBody,
      "  return c.json({ received: true }, 200);",
      "});",
      "",
    ]
      .filter(Boolean)
      .join("\n"),
    "src/db/schema/billing.ts": [
      'import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";',
      'import { generateId } from "../../lib/id";',
      context.resolvedModules.includes("organizations")
        ? 'import { organization } from "./auth";'
        : 'import { user as organization } from "./auth";',
      "",
      'export const billingFeatureValues = ["projects", "storage", "team_members", "priority_support"] as const;',
      'export const billingPlanFeatureValueTypeValues = ["boolean", "integer"] as const;',
      'export const billingSubscriptionStatusValues = ["active", "past_due", "canceled", "trialing"] as const;',
      "",
      'export const billingFeatureEnum = pgEnum("billing_feature", billingFeatureValues);',
      'export const billingPlanFeatureValueTypeEnum = pgEnum("billing_plan_feature_value_type", billingPlanFeatureValueTypeValues);',
      'export const billingSubscriptionStatusEnum = pgEnum("billing_subscription_status", billingSubscriptionStatusValues);',
      "",
      "export type BillingFeature = (typeof billingFeatureValues)[number];",
      "",
      'export const plan = pgTable("plan", {',
      '  id: text("id").primaryKey().$defaultFn(() => generateId()),',
      '  name: varchar("name", { length: 100 }).notNull(),',
      '  slug: varchar("slug", { length: 50 }).notNull(),',
      '  stripe_price_id: text("stripe_price_id").notNull(),',
      '  monthly_price_cents: integer("monthly_price_cents").notNull(),',
      '  is_active: boolean("is_active").default(true).notNull(),',
      '  created_at: timestamp("created_at").defaultNow().notNull(),',
      '  updated_at: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),',
      '}, table => [uniqueIndex("plan_slug_unique").on(table.slug), uniqueIndex("plan_stripe_price_id_unique").on(table.stripe_price_id), index("plan_is_active_idx").on(table.is_active)]);',
      "",
      'export const planFeature = pgTable("plan_feature", {',
      '  id: text("id").primaryKey().$defaultFn(() => generateId()),',
      '  plan_id: text("plan_id").notNull().references(() => plan.id, { onDelete: "cascade" }),',
      '  feature: billingFeatureEnum("feature").notNull(),',
      '  value_type: billingPlanFeatureValueTypeEnum("value_type").notNull(),',
      '  value_boolean: boolean("value_boolean"),',
      '  value_integer: integer("value_integer"),',
      '  created_at: timestamp("created_at").defaultNow().notNull(),',
      '  updated_at: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),',
      '}, table => [index("plan_feature_plan_id_idx").on(table.plan_id), uniqueIndex("plan_feature_plan_feature_unique").on(table.plan_id, table.feature)]);',
      "",
      'export const subscription = pgTable("subscription", {',
      '  id: text("id").primaryKey().$defaultFn(() => generateId()),',
      `  organization_id: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),`,
      '  plan_id: text("plan_id").notNull().references(() => plan.id, { onDelete: "restrict" }),',
      '  stripe_subscription_id: text("stripe_subscription_id").notNull(),',
      '  stripe_customer_id: text("stripe_customer_id").notNull(),',
      '  status: billingSubscriptionStatusEnum("status").notNull(),',
      '  current_period_start: timestamp("current_period_start"),',
      '  current_period_end: timestamp("current_period_end"),',
      '  canceled_at: timestamp("canceled_at"),',
      '  created_at: timestamp("created_at").defaultNow().notNull(),',
      '  updated_at: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),',
      '}, table => [uniqueIndex("subscription_org_id_unique").on(table.organization_id), uniqueIndex("subscription_stripe_subscription_id_unique").on(table.stripe_subscription_id), index("subscription_plan_id_idx").on(table.plan_id), index("subscription_status_idx").on(table.status)]);',
      "",
    ].join("\n"),
    "src/modules/billing/model.ts": [
      'import { z } from "zod";',
      "",
      'const billingFeatureSchema = z.enum(["projects", "storage", "team_members", "priority_support"]);',
      "export const planSchema = z.object({ id: z.string(), name: z.string(), slug: z.string(), stripe_price_id: z.string(), monthly_price_cents: z.number().int(), is_active: z.boolean() });",
      'export const planFeatureSchema = z.object({ id: z.string(), plan_id: z.string(), feature: billingFeatureSchema, value_type: z.enum(["boolean", "integer"]), value_boolean: z.boolean().nullable().optional(), value_integer: z.number().int().nullable().optional() });',
      'export const subscriptionSchema = z.object({ id: z.string(), organization_id: z.string(), plan_id: z.string(), stripe_subscription_id: z.string(), stripe_customer_id: z.string(), status: z.enum(["active", "past_due", "canceled", "trialing"]) });',
      "export const tenantBillingResponseSchema = z.object({ plans: z.array(planSchema.extend({ features: z.array(planFeatureSchema) })), subscription: subscriptionSchema.nullable(), features: z.record(z.string(), z.union([z.boolean(), z.number().int()])) });",
      "export const checkoutSessionRequestSchema = z.object({ plan_id: z.string().trim().min(1) });",
      "",
    ].join("\n"),
    "src/modules/billing/repository.ts": [
      'import { and, asc, eq, inArray } from "drizzle-orm";',
      'import { db, type Database } from "../../db";',
      'import { plan, planFeature, subscription, type BillingFeature } from "../../db/schema";',
      "",
      'type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];',
      "type DatabaseClient = Database | Transaction;",
      'const ACTIVE_STATUSES = ["active", "trialing"] as const;',
      "",
      "export async function listPlansWithFeatures(database: DatabaseClient = db) {",
      "  const plans = await database.select().from(plan).orderBy(asc(plan.monthly_price_cents));",
      "  const features = await database.select().from(planFeature);",
      "  return plans.map(record => ({ plan: record, features: features.filter(feature => feature.plan_id === record.id) }));",
      "}",
      "",
      "export async function findSubscriptionByOrganizationId(organizationId: string, database: DatabaseClient = db) {",
      "  const [record] = await database.select().from(subscription).where(eq(subscription.organization_id, organizationId)).limit(1);",
      "  return record ?? null;",
      "}",
      "",
      "export async function getFeatureValueForOrganization(database: DatabaseClient, organizationId: string, feature: BillingFeature) {",
      "  const [record] = await database",
      "    .select({ feature: planFeature })",
      "    .from(subscription)",
      "    .innerJoin(planFeature, eq(subscription.plan_id, planFeature.plan_id))",
      "    .where(and(eq(subscription.organization_id, organizationId), inArray(subscription.status, ACTIVE_STATUSES), eq(planFeature.feature, feature)))",
      "    .limit(1);",
      "  return record?.feature ?? null;",
      "}",
      "",
    ].join("\n"),
    "src/modules/billing/usecases.ts": [
      'import { db } from "../../db";',
      'import { stripeClient } from "../../lib/integrations/stripe";',
      'import { NotFoundError } from "../../lib/errors";',
      'import * as repository from "./repository";',
      "",
      "export async function buildBillingView(organizationId: string) {",
      "  const plans = await repository.listPlansWithFeatures(db);",
      "  const subscription = await repository.findSubscriptionByOrganizationId(organizationId, db);",
      '  const features = Object.fromEntries((subscription ? plans.find(plan => plan.plan.id === subscription.plan_id)?.features ?? [] : []).map(feature => [feature.feature, feature.value_type === "boolean" ? feature.value_boolean ?? false : feature.value_integer ?? 0]));',
      "  return { plans, subscription, features };",
      "}",
      "",
      "export async function createCheckoutSessionForOrganization(organizationId: string, planId: string) {",
      "  const plans = await repository.listPlansWithFeatures(db);",
      "  const targetPlan = plans.find(plan => plan.plan.id === planId)?.plan;",
      '  if (!targetPlan) throw new NotFoundError("Billing plan");',
      "  return stripeClient.createCheckoutSession({ customerId: organizationId, planId: targetPlan.id, planSlug: targetPlan.slug, priceId: targetPlan.stripe_price_id });",
      "}",
      "",
    ].join("\n"),
    "src/modules/billing/route.ts": [
      'import { zValidator } from "@hono/zod-validator";',
      'import { Hono } from "hono";',
      'import { ok } from "../../lib/response";',
      context.resolvedModules.includes("organizations")
        ? 'import { getOrgId } from "../../lib/auth/org-context";'
        : "",
      'import { checkoutSessionRequestSchema } from "./model";',
      'import { buildBillingView, createCheckoutSessionForOrganization } from "./usecases";',
      "",
      "export const billingModule = new Hono()",
      '  .get("/", async c => {',
      `    const organizationId = ${context.resolvedModules.includes("organizations") ? "getOrgId(c)" : 'c.get("user")?.id ?? "anonymous"'};`,
      "    return c.json(ok(await buildBillingView(organizationId)));",
      "  })",
      '  .post("/checkout-session", zValidator("json", checkoutSessionRequestSchema), async c => {',
      `    const organizationId = ${context.resolvedModules.includes("organizations") ? "getOrgId(c)" : 'c.get("user")?.id ?? "anonymous"'};`,
      '    const session = await createCheckoutSessionForOrganization(organizationId, c.req.valid("json").plan_id);',
      "    return c.redirect(session.url ?? `/billing?session_id=${session.id}`, 303);",
      "  });",
      "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function buildStorageFiles() {
  return {
    "src/lib/storage/client.ts": [
      'import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";',
      'import { getSignedUrl } from "@aws-sdk/s3-request-presigner";',
      'import { env } from "../../env";',
      "",
      "export function createStorageClient() {",
      "  return new S3Client({",
      '    region: env.S3_REGION ?? "sa-east-1",',
      "    endpoint: env.S3_ENDPOINT,",
      "    forcePathStyle: Boolean(env.S3_ENDPOINT),",
      "    credentials: env.S3_ACCESS_KEY && env.S3_SECRET_KEY ? { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } : undefined,",
      "  });",
      "}",
      "",
      "export async function createPresignedUploadUrl(key: string, contentType: string) {",
      "  const client = createStorageClient();",
      "  return getSignedUrl(client, new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: contentType }), { expiresIn: 900 });",
      "}",
      "",
      "export async function createPresignedDownloadUrl(key: string) {",
      "  const client = createStorageClient();",
      "  return getSignedUrl(client, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn: 3600 });",
      "}",
      "",
    ].join("\n"),
    "src/lib/storage/index.ts": 'export * from "./client";\n',
  };
}

function buildEmailFiles() {
  return {
    "src/lib/emails/send.ts": [
      'import { render } from "@react-email/components";',
      'import nodemailer from "nodemailer";',
      'import { z } from "zod";',
      'import { createResendClient } from "../integrations/resend";',
      'import { BaseEmail } from "./templates/base";',
      "",
      "const sendEmailSchema = z.object({",
      "  subject: z.string().trim().min(1),",
      "  to: z.array(z.string().email()).min(1),",
      "  body: z.string().trim().min(1),",
      "});",
      "",
      "export async function sendEmail(input: z.input<typeof sendEmailSchema>) {",
      "  const payload = sendEmailSchema.parse(input);",
      "  const html = await render(BaseEmail({ body: payload.body, heading: payload.subject }));",
      "  if (process.env.RESEND_API_KEY) {",
      "    const resendClient = createResendClient();",
      '    return resendClient.sendEmail({ from: process.env.EMAIL_FROM ?? "noreply@example.com", html, subject: payload.subject, text: payload.body, to: payload.to });',
      "  }",
      '  const transporter = nodemailer.createTransport({ host: process.env.MAILPIT_HOST ?? "127.0.0.1", port: Number(process.env.MAILPIT_PORT ?? 1025), secure: false });',
      '  return transporter.sendMail({ from: process.env.EMAIL_FROM ?? "noreply@example.com", html, subject: payload.subject, text: payload.body, to: payload.to });',
      "}",
      "",
    ].join("\n"),
    "src/lib/emails/templates/base.tsx": [
      'import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";',
      "",
      "export function BaseEmail(props: { body: string; heading: string }) {",
      "  return (",
      "    <Html>",
      "      <Head />",
      "      <Preview>{props.heading}</Preview>",
      "      <Body style={{ backgroundColor: '#f6f4ef', fontFamily: 'Geist, sans-serif' }}>",
      "        <Container style={{ maxWidth: '560px', margin: '40px auto', backgroundColor: '#ffffff', padding: '32px', borderRadius: '24px' }}>",
      "          <Section>",
      "            <Heading>{props.heading}</Heading>",
      "            <Text>{props.body}</Text>",
      "          </Section>",
      "        </Container>",
      "      </Body>",
      "    </Html>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "src/lib/integrations/resend.ts": [
      'import { z } from "zod";',
      "",
      "const sendEmailSchema = z.object({",
      "  from: z.string().trim().min(1),",
      "  html: z.string().trim().min(1),",
      "  subject: z.string().trim().min(1),",
      "  text: z.string().trim().min(1),",
      "  to: z.array(z.string().email()).min(1),",
      "});",
      "",
      "export function createResendClient(fetcher: typeof fetch = fetch) {",
      "  return {",
      "    async sendEmail(input: z.input<typeof sendEmailSchema>) {",
      "      const payload = sendEmailSchema.parse(input);",
      '      const response = await fetcher("https://api.resend.com/emails", {',
      '        method: "POST",',
      '        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },',
      "        body: JSON.stringify(payload),",
      "      });",
      "      if (!response.ok) {",
      "        throw new Error(`Resend request failed with status ${response.status}`);",
      "      }",
      "      return response.json();",
      "    },",
      "  };",
      "}",
      "",
    ].join("\n"),
  };
}

function buildInngestFiles(context: GenerateContext) {
  return {
    "src/lib/inngest.ts": [
      'import { EventSchemas, Inngest } from "inngest";',
      'import { z } from "zod";',
      "",
      `export const INNGEST_APP_ID = "${context.projectName}";`,
      'export const INNGEST_SERVE_PATH = "/api/inngest";',
      "",
      "export const billingStripeWebhookReceivedEventDataSchema = z.object({",
      "  eventId: z.string().trim().min(1),",
      "  eventType: z.string().trim().min(1),",
      "  payload: z.record(z.string(), z.unknown()),",
      "});",
      "",
      "export const emailSendRequestedEventDataSchema = z.object({",
      "  emails: z.array(z.object({ to: z.array(z.string().email()).min(1), subject: z.string().trim().min(1), body: z.string().trim().min(1) })).min(1),",
      "});",
      "",
      "export const inngest = new Inngest({",
      `  id: "${context.projectName}",`,
      "  schemas: new EventSchemas().fromSchema({",
      '    "billing/stripe.webhook.received": billingStripeWebhookReceivedEventDataSchema,',
      '    "email/send.requested": emailSendRequestedEventDataSchema,',
      "  }),",
      "});",
      "",
      'export const inngestServeHandler = inngest.createFunction({ id: "health-check" }, { event: "email/send.requested" }, async ({ event }) => ({ count: event.data.emails.length }));',
      "",
    ].join("\n"),
    "src/jobs/index.ts": [
      'import { inngest } from "../lib/inngest";',
      "",
      "export const exampleJob = inngest.createFunction(",
      '  { id: "example-job" },',
      '  { event: "email/send.requested" },',
      "  async ({ event }) => ({ processed: event.data.emails.length })",
      ");",
      "",
      "export const functions = [exampleJob];",
      "",
    ].join("\n"),
    "src/jobs/example.ts": "export {};\n",
  };
}

function buildObservabilityFiles(context: GenerateContext) {
  return {
    "src/lib/tracing.ts": replaceTemplateTokens(
      [
        'import { trace, SpanKind, SpanStatusCode, context, propagation, ROOT_CONTEXT, type TextMapGetter, type TextMapSetter } from "@opentelemetry/api";',
        'import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";',
        'import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";',
        'import { resourceFromAttributes } from "@opentelemetry/resources";',
        'import { NodeSDK } from "@opentelemetry/sdk-node";',
        'import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";',
        'import { createMiddleware } from "hono/factory";',
        "",
        "let tracingSdk: NodeSDK | null = null;",
        "const headersGetter: TextMapGetter<Headers> = { get: (carrier, key) => carrier.get(key) ?? undefined, keys: carrier => Array.from(carrier.keys()) };",
        "const headersSetter: TextMapSetter<Headers> = { set: (carrier, key, value) => carrier.set(key, value) };",
        "",
        "export type TracingVariables = Record<string, never>;",
        "",
        "export async function initializeTracing(rawEnv: Record<string, string | undefined> = process.env) {",
        '  if (rawEnv.TRACING_ENABLED === "0" || rawEnv.NODE_ENV === "test") return false;',
        "  if (tracingSdk) return true;",
        "  tracingSdk = new NodeSDK({",
        "    autoDetectResources: false,",
        "    resource: resourceFromAttributes({",
        '      "deployment.environment.name": rawEnv.NODE_ENV ?? "development",',
        '      "service.name": rawEnv.OTEL_SERVICE_NAME ?? "{{projectName}}-backend",',
        "    }),",
        '    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: rawEnv.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4317" }))],',
        "    instrumentations: [new HttpInstrumentation()],",
        "  });",
        "  await tracingSdk.start();",
        "  return true;",
        "}",
        "",
        "export async function shutdownTracing() {",
        "  if (!tracingSdk) return;",
        "  const sdk = tracingSdk;",
        "  tracingSdk = null;",
        "  await sdk.shutdown();",
        "}",
        "",
        "export const tracingMiddleware = createMiddleware(async (c, next) => {",
        '  const tracer = trace.getTracer("{{projectName}}-backend");',
        "  const extractedContext = propagation.extract(ROOT_CONTEXT, c.req.raw.headers, headersGetter);",
        "  return tracer.startActiveSpan(`${c.req.method} ${new URL(c.req.url).pathname}`, { kind: SpanKind.SERVER }, extractedContext, async span => {",
        "    try {",
        "      await next();",
        '      span.setAttribute("http.response.status_code", c.res.status);',
        "      span.setStatus({ code: c.res.status >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.OK });",
        "    } catch (error) {",
        "      span.recordException(error as Error);",
        "      span.setStatus({ code: SpanStatusCode.ERROR });",
        "      throw error;",
        "    } finally {",
        "      propagation.inject(context.active(), c.res.headers, headersSetter);",
        "      span.end();",
        "    }",
        "  });",
        "});",
        "",
      ].join("\n"),
      context.tokens
    ),
    "src/lib/sentry.ts": [
      'import * as Sentry from "@sentry/bun";',
      "",
      "let isSentryInitialized = false;",
      "",
      "function parseTracesSampleRate(rawValue: string | undefined) {",
      "  if (!rawValue) return 0.1;",
      "  const parsedValue = Number(rawValue);",
      "  return Number.isFinite(parsedValue) && parsedValue >= 0 && parsedValue <= 1 ? parsedValue : 0.1;",
      "}",
      "",
      "export function initializeSentry(rawEnv: Record<string, string | undefined> = process.env) {",
      "  const dsn = rawEnv.SENTRY_DSN?.trim();",
      "  if (!dsn || isSentryInitialized) return Boolean(dsn);",
      '  Sentry.init({ dsn, enabled: true, environment: rawEnv.NODE_ENV ?? "development", tracesSampleRate: parseTracesSampleRate(rawEnv.SENTRY_TRACES_SAMPLE_RATE) });',
      "  isSentryInitialized = true;",
      "  return true;",
      "}",
      "",
    ].join("\n"),
  };
}

function buildRedisFiles() {
  return {
    "src/lib/redis.ts": [
      'import type { RedisClient as RateLimitRedisClient } from "@hono-rate-limiter/redis";',
      "",
      'type BunRedisClient = import("bun").RedisClient;',
      'type BunRedisConstructor = typeof import("bun").RedisClient;',
      "",
      "let sharedRedisClient: BunRedisClient | null = null;",
      "",
      "export function hasBunRedisClient() {",
      "  const bun = globalThis as typeof globalThis & { Bun?: { RedisClient?: BunRedisConstructor } };",
      '  return typeof bun.Bun?.RedisClient === "function";',
      "}",
      "",
      "export function getRedisClient(rawEnv: Record<string, string | undefined> = process.env) {",
      "  const bun = globalThis as typeof globalThis & { Bun?: { RedisClient?: BunRedisConstructor } };",
      "  const RedisClient = bun.Bun?.RedisClient;",
      '  if (!RedisClient) throw new Error("Bun RedisClient is unavailable outside the Bun runtime");',
      "  if (!sharedRedisClient) {",
      '    sharedRedisClient = new RedisClient(rawEnv.REDIS_URL ?? "redis://localhost:6379");',
      "  }",
      "  return sharedRedisClient;",
      "}",
      "",
      "export function createRedisRateLimitClient(rawEnv: Record<string, string | undefined> = process.env): RateLimitRedisClient {",
      "  const client = getRedisClient(rawEnv);",
      "  return {",
      "    async scriptLoad(script: string) {",
      '      const result = await client.send("SCRIPT", ["LOAD", script]);',
      '      if (typeof result !== "string") throw new TypeError("Redis SCRIPT LOAD returned a non-string response");',
      "      return result;",
      "    },",
      "    evalsha(sha1: string, keys: string[], args: unknown[]) {",
      '      return client.send("EVALSHA", [sha1, keys.length.toString(), ...keys, ...args.map(String)]);',
      "    },",
      "    decr(key: string) { return client.decr(key); },",
      "    del(key: string) { return client.del(key); },",
      "  };",
      "}",
      "",
    ].join("\n"),
    "src/plugins/rate-limiter.ts": [
      'import { RedisStore } from "@hono-rate-limiter/redis";',
      'import { createMiddleware } from "hono/factory";',
      'import { MemoryStore, rateLimiter } from "hono-rate-limiter";',
      'import { z } from "zod";',
      'import { createRedisRateLimitClient, hasBunRedisClient } from "../lib/redis";',
      "",
      "const environmentSchema = z.object({",
      "  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().optional(),",
      "  RATE_LIMIT_AUTHENTICATED_LIMIT: z.coerce.number().int().positive().optional(),",
      "  RATE_LIMIT_PUBLIC_LIMIT: z.coerce.number().int().positive().optional(),",
      "  RATE_LIMIT_WEBHOOK_LIMIT: z.coerce.number().int().positive().optional(),",
      "});",
      "",
      "function resolveConfig(rawEnv: Record<string, string | undefined> = process.env) {",
      "  const parsedEnv = environmentSchema.parse(rawEnv);",
      "  return {",
      "    windowMs: parsedEnv.RATE_LIMIT_WINDOW_MS ?? 60000,",
      "    limits: {",
      "      authenticated: parsedEnv.RATE_LIMIT_AUTHENTICATED_LIMIT ?? 300,",
      "      public: parsedEnv.RATE_LIMIT_PUBLIC_LIMIT ?? 30,",
      "      webhook: parsedEnv.RATE_LIMIT_WEBHOOK_LIMIT ?? 120,",
      "    },",
      "  };",
      "}",
      "",
      "function createStore() {",
      "  if (!hasBunRedisClient()) return new MemoryStore();",
      "  return new RedisStore({ client: createRedisRateLimitClient() });",
      "}",
      "",
      "function createLimiter(limit: number, keyGenerator: (c: any) => string) {",
      "  const config = resolveConfig();",
      "  return createMiddleware(async (c, next) => {",
      "    const handler = rateLimiter({ keyGenerator, limit, standardHeaders: 'draft-6', store: createStore(), windowMs: config.windowMs });",
      "    return handler(c, next);",
      "  });",
      "}",
      "",
      "export type RateLimitVariables = Record<string, never>;",
      'export const publicRateLimit = createLimiter(resolveConfig().limits.public, c => c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown-ip");',
      'export const authenticatedRateLimit = createLimiter(resolveConfig().limits.authenticated, c => c.get("user")?.id ?? c.req.header("x-forwarded-for") ?? "anonymous");',
      "export const webhookRateLimit = createLimiter(resolveConfig().limits.webhook, c => c.req.path);",
      "",
    ].join("\n"),
  };
}

function buildStorybookFiles() {
  return {
    "packages/frontend/.storybook/main.ts": [
      'import type { StorybookConfig } from "@storybook/react-vite";',
      "",
      "const config: StorybookConfig = {",
      '  framework: "@storybook/react-vite",',
      '  stories: ["../src/**/*.stories.@(ts|tsx)"],',
      '  addons: ["@storybook/addon-a11y", "@storybook/addon-docs", "@storybook/addon-onboarding", "@storybook/addon-themes"],',
      "};",
      "",
      "export default config;",
      "",
    ].join("\n"),
    "packages/frontend/.storybook/preview.tsx": [
      'import type { Preview } from "@storybook/react";',
      'import "../src/styles.css";',
      "",
      "const preview: Preview = {",
      "  parameters: {",
      '    backgrounds: { default: "app" },',
      "  },",
      "};",
      "",
      "export default preview;",
      "",
    ].join("\n"),
    "packages/frontend/src/components/ui/button.stories.tsx": [
      'import type { Meta, StoryObj } from "@storybook/react";',
      'import { Button } from "./button";',
      "",
      "const meta = {",
      '  title: "UI/Button",',
      "  component: Button,",
      "} satisfies Meta<typeof Button>;",
      "",
      "export default meta;",
      "type Story = StoryObj<typeof meta>;",
      "",
      "export const Primary: Story = {",
      "  args: {",
      '    children: "Click me",',
      "  },",
      "};",
      "",
    ].join("\n"),
  };
}

async function writeModuleFiles(context: GenerateContext) {
  if (context.resolvedModules.includes("auth")) {
    await writeTextFile(
      path.join(context.targetDir, "packages/backend/src/plugins/auth.ts"),
      buildAuthPlugin(context)
    );
    await writeTextFile(
      path.join(context.targetDir, "packages/backend/src/lib/auth/auth.ts"),
      buildAuthConfig(context)
    );
    await writeTextFile(
      path.join(context.targetDir, "packages/backend/src/lib/auth/auth-context.ts"),
      buildAuthContext()
    );
    await writeTextFile(
      path.join(context.targetDir, "packages/backend/src/db/schema/auth.ts"),
      buildAuthSchema(context)
    );
  }

  if (context.resolvedModules.includes("organizations")) {
    for (const [relativePath, content] of Object.entries(buildOrganizationFiles())) {
      await writeTextFile(path.join(context.targetDir, "packages/backend", relativePath), content);
    }
  }

  if (context.resolvedModules.includes("stripe")) {
    for (const [relativePath, content] of Object.entries(buildStripeFiles(context))) {
      await writeTextFile(path.join(context.targetDir, "packages/backend", relativePath), content);
    }
  }

  if (context.resolvedModules.includes("storage")) {
    for (const [relativePath, content] of Object.entries(buildStorageFiles())) {
      await writeTextFile(path.join(context.targetDir, "packages/backend", relativePath), content);
    }
  }

  if (context.resolvedModules.includes("email")) {
    for (const [relativePath, content] of Object.entries(buildEmailFiles())) {
      await writeTextFile(path.join(context.targetDir, "packages/backend", relativePath), content);
    }
  }

  if (context.resolvedModules.includes("inngest")) {
    for (const [relativePath, content] of Object.entries(buildInngestFiles(context))) {
      await writeTextFile(path.join(context.targetDir, "packages/backend", relativePath), content);
    }
  }

  if (context.resolvedModules.includes("observability")) {
    for (const [relativePath, content] of Object.entries(buildObservabilityFiles(context))) {
      await writeTextFile(path.join(context.targetDir, "packages/backend", relativePath), content);
    }
  }

  if (context.resolvedModules.includes("redis")) {
    for (const [relativePath, content] of Object.entries(buildRedisFiles())) {
      await writeTextFile(path.join(context.targetDir, "packages/backend", relativePath), content);
    }
  }

  if (context.resolvedModules.includes("storybook")) {
    for (const [relativePath, content] of Object.entries(buildStorybookFiles())) {
      await writeTextFile(path.join(context.targetDir, relativePath), content);
    }
  }
}

async function writeDynamicFiles(context: GenerateContext) {
  await ensureDir(path.join(context.targetDir, ".github/workflows"));
  await ensureDir(path.join(context.targetDir, ".husky"));
  await ensureDir(path.join(context.targetDir, "docker/postgres"));
  await ensureDir(path.join(context.targetDir, ".claude"));
  await ensureDir(path.join(context.targetDir, ".agents"));

  await patchPluginNames(context);

  await writeTextFile(
    path.join(context.targetDir, "package.json"),
    toJson(buildRootPackageJson(context))
  );
  await writeTextFile(
    path.join(context.targetDir, "turbo.json"),
    toJson(buildTurboConfig(context))
  );
  await writeTextFile(path.join(context.targetDir, ".gitignore"), buildGitignore());
  await writeTextFile(
    path.join(context.targetDir, ".oxlintrc.json"),
    buildOxlintConfig(context.projectName)
  );
  await writeTextFile(
    path.join(context.targetDir, "commitlint.config.ts"),
    buildCommitlintConfig()
  );
  await writeTextFile(path.join(context.targetDir, "Makefile"), buildMakefile(context));
  await writeTextFile(
    path.join(context.targetDir, "docker-compose.yml"),
    buildDockerCompose(context)
  );
  await writeTextFile(
    path.join(context.targetDir, "docker/postgres/init-test-db.sh"),
    buildInitTestDbScript(context)
  );
  await writeInstructionFiles(context.targetDir, buildClaudeMd(context, separatedClaudeMdBuilder));
  await writeTextFile(path.join(context.targetDir, ".claude/settings.json"), buildClaudeSettings());
  await writeTextFile(path.join(context.targetDir, ".github/workflows/ci.yaml"), buildCiWorkflow());
  await writeTextFile(
    path.join(context.targetDir, ".husky/pre-commit"),
    "#!/usr/bin/env sh\nbunx lint-staged\n"
  );
  await writeTextFile(
    path.join(context.targetDir, ".husky/commit-msg"),
    '#!/usr/bin/env sh\nbunx --no -- commitlint --edit "$1"\n'
  );

  await writeTextFile(
    path.join(context.targetDir, "packages/frontend/package.json"),
    toJson(buildFrontendPackageJson(context))
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/frontend/index.html"),
    buildFrontendIndexHtml(context)
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/frontend/vitest.config.ts"),
    buildFrontendVitestConfig(context)
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/frontend/src/main.tsx"),
    buildFrontendMain()
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/frontend/src/styles.css"),
    buildFrontendStyles()
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/frontend/src/stores/use-theme-store.ts"),
    buildFrontendThemeStore(context)
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/frontend/src/components/app-sidebar.tsx"),
    buildFrontendSidebar(context)
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/frontend/src/routes/_dashboard/index.tsx"),
    buildFrontendDashboardIndex(context)
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/frontend/src/routes/_dashboard/settings.tsx"),
    buildFrontendSettings()
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/frontend/src/routeTree.gen.ts"),
    buildFrontendRouteTree()
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/frontend/src/App.test.tsx"),
    buildFrontendAppTest(context)
  );

  await writeTextFile(
    path.join(context.targetDir, "packages/backend/package.json"),
    toJson(buildBackendPackageJson(context))
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/backend/.env.example"),
    buildBackendEnvExample(context)
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/backend/src/index.ts"),
    buildBackendIndex(context)
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/backend/src/env.ts"),
    buildBackendEnvTs(context)
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/backend/src/app.ts"),
    buildBackendApp(context)
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/backend/src/routes/health.ts"),
    buildBackendHealthRoute(context)
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/backend/src/plugins/index.ts"),
    buildBackendPluginsIndex(context)
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/backend/src/db/schema/index.ts"),
    buildBackendSchemaIndex(context)
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/backend/src/db/schema/items.ts"),
    buildBackendItemsSchema()
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/backend/src/types/index.ts"),
    buildBackendTypesIndex(context)
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/backend/src/modules/items/index.ts"),
    buildBackendItemsIndex()
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/backend/src/modules/items/model.ts"),
    buildBackendItemsModel()
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/backend/src/modules/items/repository.ts"),
    buildBackendItemsRepository()
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/backend/src/modules/items/usecases.ts"),
    buildBackendItemsUsecases()
  );
  await writeTextFile(
    path.join(context.targetDir, "packages/backend/src/modules/items/route.ts"),
    buildBackendItemsRoute()
  );

  await writeModuleFiles(context);
}

async function generateSeparated(context: GenerateContext) {
  await copyDirectory(BASE_ROOT_DIR, context.targetDir, context.tokens);
  await copyDirectory(
    BASE_FRONTEND_DIR,
    path.join(context.targetDir, "packages/frontend"),
    context.tokens
  );
  await copyDirectory(
    BASE_BACKEND_DIR,
    path.join(context.targetDir, "packages/backend"),
    context.tokens
  );

  await copyModuleSkills(context);
  await copyModuleOverlays(context);
  await writeDynamicFiles(context);
}

async function copyModuleSkills(context: GenerateContext) {
  if (!(await pathExists(SKILLS_DIR))) {
    throw new Error(
      "Skills submodule not initialized. Run: git submodule update --init --recursive"
    );
  }

  const selectedSkills = resolveSkillsForModules(context.resolvedModules, context.stackModel);

  if (selectedSkills.size === 0) {
    return;
  }

  await copySkillsToAgentDirs(context.targetDir, selectedSkills, context);
}

async function copyModuleOverlays(context: GenerateContext) {
  for (const moduleName of context.resolvedModules) {
    const overlayDir =
      MODULE_REGISTRY[moduleName].templateDir ?? path.join(TEMPLATES_DIR, "modules", moduleName);

    if (await pathExists(overlayDir)) {
      await copyDirectory(
        overlayDir,
        await resolveModuleOverlayTargetDir(context.targetDir, overlayDir),
        context.tokens
      );
    }
  }
}

export async function generate(config: GeneratorConfig): Promise<GenerateResult> {
  const s = spinner();
  const resolvedModules = resolveSelectedModules(config.selectedModules);
  const targetDir = resolveTargetDirectory(config.targetDir);
  const tokens = buildTemplateTokens(config.projectName);
  const context: GenerateContext = {
    projectName: config.projectName,
    stackModel: config.stackModel,
    resolvedModules,
    targetDir,
    tokens,
  };

  await assertTargetDirectoryIsReady(targetDir);

  s.start("Scaffolding project...");
  await ensureDir(targetDir);

  switch (config.stackModel) {
    case "separated":
      await generateSeparated(context);
      break;
    case "tanstack-start":
      await generateTanStackStart(context);
      break;
  }

  s.stop("Project scaffolded.");

  if (config.installDependencies) {
    s.start("Installing dependencies...");
    await runCommand("bun", ["install"], targetDir);
    s.stop("Dependencies installed.");
  }

  if (config.initGit) {
    s.start("Initializing git...");
    await runCommand("git", ["init"], targetDir);
    await runCommand("git", ["add", "-A"], targetDir);
    await runCommand(
      "git",
      ["commit", "-m", "chore: initial project scaffold via @compozy/devstack"],
      targetDir
    );
    s.stop("Git initialized.");
  }

  return {
    resolvedModules,
    targetDir,
  };
}

export const generateProject = generate;
