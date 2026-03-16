import { readFile } from "node:fs/promises";
import path from "node:path";
import { MODULE_REGISTRY } from "../modules/index.ts";
import {
  copyDirectoryWithTemplates as copyDirectory,
  ensureDir,
  pathExists,
  writeTextFile,
} from "../utils/files.ts";
import { mergePackageJson, type PackageJsonShape } from "../utils/packages.ts";
import { replaceTemplateTokens } from "../utils/template.ts";
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
} from "./shared.ts";
import type { GenerateContext } from "./types.ts";

const BASE_ROOT_DIR = path.join(TEMPLATES_DIR, "base", "root");
const BASE_FRONTEND_DIR = path.join(TEMPLATES_DIR, "base", "frontend");
const BASE_BACKEND_DIR = path.join(TEMPLATES_DIR, "base", "backend");

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateTanStackStart(context: GenerateContext) {
  // 1. Copy shared root templates (monorepo root: .husky, .github, lint-plugins, tsconfig etc.)
  await copyDirectory(BASE_ROOT_DIR, context.targetDir, context.tokens);

  // 2. Copy shared frontend UI components (shadcn/ui) into packages/app/src/
  await copyFrontendSharedAssets(context);

  // 3. Copy module skills
  await copyModuleSkills(context);

  // 4. Write all dynamic files
  await writeSharedDynamicFiles(context);
  await writeAppDynamicFiles(context);
  await writeServerFiles(context);
  await writeModuleFiles(context);
}

// ---------------------------------------------------------------------------
// Template copying
// ---------------------------------------------------------------------------

async function copyFrontendSharedAssets(context: GenerateContext) {
  const appSrcDir = path.join(context.targetDir, "packages/app/src");
  await ensureDir(appSrcDir);

  // Copy shared UI components, hooks, and lib from the frontend base template
  const sharedDirs = ["components", "hooks", "lib"];
  for (const dir of sharedDirs) {
    const srcDir = path.join(BASE_FRONTEND_DIR, "src", dir);
    if (await pathExists(srcDir)) {
      await copyDirectory(srcDir, path.join(appSrcDir, dir), context.tokens);
    }
  }

  const sharedFiles = ["test-setup.ts"];
  for (const fileName of sharedFiles) {
    const sourcePath = path.join(BASE_FRONTEND_DIR, "src", fileName);
    if (await pathExists(sourcePath)) {
      const content = await readFile(sourcePath, "utf8");
      await writeTextFile(
        path.join(appSrcDir, fileName),
        replaceTemplateTokens(content, context.tokens)
      );
    }
  }
}

async function copyBackendSharedAssets(context: GenerateContext) {
  const fileMappings = new Map<string, string>([
    ["src/lib/errors.ts", "server/lib/errors.ts"],
    ["src/lib/id.ts", "server/lib/id.ts"],
    ["src/lib/lazy.ts", "server/lib/lazy.ts"],
    ["src/lib/logger.ts", "server/lib/logger.ts"],
    ["src/lib/pagination.ts", "server/lib/pagination.ts"],
    ["src/lib/response.ts", "server/lib/response.ts"],
    ["src/test-utils/db.ts", "server/test-utils/db.ts"],
    ["src/test-utils/request.ts", "server/test-utils/request.ts"],
  ]);

  await Promise.all(
    Array.from(fileMappings.entries()).map(async ([sourcePath, targetPath]) => {
      const absoluteSourcePath = path.join(BASE_BACKEND_DIR, sourcePath);

      if (!(await pathExists(absoluteSourcePath))) {
        return;
      }

      const content = await readFile(absoluteSourcePath, "utf8");
      await writeTextFile(
        path.join(context.targetDir, "packages/app", targetPath),
        replaceTemplateTokens(content, context.tokens)
      );
    })
  );
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

// ---------------------------------------------------------------------------
// Shared dynamic files (root-level: package.json, turbo, docker, claude, etc.)
// ---------------------------------------------------------------------------

async function writeSharedDynamicFiles(context: GenerateContext) {
  await ensureDir(path.join(context.targetDir, ".github/workflows"));
  await ensureDir(path.join(context.targetDir, ".husky"));
  await ensureDir(path.join(context.targetDir, "docker/postgres"));
  await ensureDir(path.join(context.targetDir, ".claude"));
  await ensureDir(path.join(context.targetDir, ".agents"));

  await patchPluginNames(context);

  const builder: ClaudeMdBuilder = {
    buildClaudeMdArchitectureSection: buildArchitectureSection,
    buildSkillEnforcementBackendSection: buildSkillEnforcementBackend,
    buildBackendArchitectureRules: buildServerArchitectureRules,
  };

  await writeTextFile(
    path.join(context.targetDir, "package.json"),
    toJson(buildRootPackageJson(context))
  );
  await writeTextFile(
    path.join(context.targetDir, "turbo.json"),
    toJson(buildTurboConfig(context))
  );
  await writeTextFile(path.join(context.targetDir, ".gitignore"), buildGitignore());
  await writeTextFile(path.join(context.targetDir, ".oxlintrc.json"), buildOxlintConfig(context));
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
  await writeInstructionFiles(context.targetDir, buildClaudeMd(context, builder));
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
}

// ---------------------------------------------------------------------------
// App-level dynamic files (packages/app/*)
// ---------------------------------------------------------------------------

async function writeAppDynamicFiles(context: GenerateContext) {
  const appDir = path.join(context.targetDir, "packages/app");
  await ensureDir(path.join(appDir, "src/routes/_dashboard"));
  await ensureDir(path.join(appDir, "src/stores"));
  await ensureDir(path.join(appDir, "src/integrations/tanstack-query"));

  await writeTextFile(path.join(appDir, "package.json"), toJson(buildAppPackageJson(context)));
  await writeTextFile(path.join(appDir, "vite.config.ts"), buildAppViteConfig());
  await writeTextFile(path.join(appDir, "tsconfig.json"), toJson(buildAppTsConfig()));
  await writeTextFile(path.join(appDir, "drizzle.config.ts"), buildDrizzleConfig());
  await writeTextFile(path.join(appDir, "vitest.config.ts"), buildVitestConfig(context));

  // Entry points
  await writeTextFile(path.join(appDir, "src/client.tsx"), buildClientEntry());
  await writeTextFile(path.join(appDir, "src/server.ts"), buildServerEntry(context));
  await writeTextFile(path.join(appDir, "src/router.tsx"), buildRouterEntry());
  await writeTextFile(path.join(appDir, "src/routeTree.gen.ts"), buildRouteTree(context));

  // Routes
  await writeTextFile(path.join(appDir, "src/routes/__root.tsx"), buildRootRoute(context));
  await writeTextFile(
    path.join(appDir, "src/routes/_dashboard.tsx"),
    buildDashboardLayout(context)
  );
  await writeTextFile(
    path.join(appDir, "src/routes/_dashboard/index.tsx"),
    buildDashboardIndex(context)
  );
  await writeTextFile(path.join(appDir, "src/routes/_dashboard/settings.tsx"), buildSettingsPage());

  // Styles, stores, integrations
  await writeTextFile(path.join(appDir, "src/styles.css"), buildStyles());
  await writeTextFile(path.join(appDir, "src/stores/use-theme-store.ts"), buildThemeStore(context));
  await writeTextFile(
    path.join(appDir, "src/integrations/tanstack-query/root-provider.tsx"),
    buildQueryProvider()
  );
}

// ---------------------------------------------------------------------------
// Server-side files (packages/app/server/*)
// ---------------------------------------------------------------------------

async function writeServerFiles(context: GenerateContext) {
  const serverDir = path.join(context.targetDir, "packages/app/server");
  await ensureDir(path.join(serverDir, "db/schema"));
  await ensureDir(path.join(serverDir, "lib"));
  await ensureDir(path.join(serverDir, "functions"));
  await copyBackendSharedAssets(context);

  // API route for health
  await ensureDir(path.join(context.targetDir, "packages/app/src/routes/api"));
  await writeTextFile(
    path.join(context.targetDir, "packages/app/src/routes/api/health.ts"),
    buildHealthApiRoute(context)
  );

  // DB
  await writeTextFile(path.join(serverDir, "db/index.ts"), buildDbIndex());
  await writeTextFile(path.join(serverDir, "db/schema/index.ts"), buildDbSchemaIndex(context));
  await writeTextFile(path.join(serverDir, "db/schema/items.ts"), buildItemsSchema());

  // Lib
  await writeTextFile(path.join(serverDir, "lib/env.ts"), buildEnvTs(context));
  await writeTextFile(path.join(serverDir, "lib/request-context.ts"), buildRequestContextLib());
  await writeTextFile(path.join(serverDir, "test-utils/factories.ts"), buildTestItemFactory());
  await writeTextFile(path.join(serverDir, "test-utils/index.ts"), buildTestUtilsIndex());

  // Server functions
  await writeTextFile(path.join(serverDir, "functions/items.ts"), buildItemsFunctions());

  // .env.example
  await writeTextFile(
    path.join(context.targetDir, "packages/app/.env.example"),
    buildEnvExample(context)
  );
}

// ---------------------------------------------------------------------------
// Module files
// ---------------------------------------------------------------------------

async function writeModuleFiles(context: GenerateContext) {
  const appDir = path.join(context.targetDir, "packages/app");

  if (context.resolvedModules.includes("auth")) {
    await ensureDir(path.join(appDir, "server/lib/auth"));
    await ensureDir(path.join(appDir, "server/middleware"));
    await ensureDir(path.join(appDir, "src/routes/api/auth"));
    await writeTextFile(path.join(appDir, "server/lib/auth/auth.ts"), buildAuthConfig(context));
    await writeTextFile(path.join(appDir, "server/middleware/auth.ts"), buildAuthMiddleware());
    await writeTextFile(path.join(appDir, "src/routes/api/auth/$.ts"), buildAuthApiRoute());
    await writeTextFile(path.join(appDir, "server/db/schema/auth.ts"), buildAuthSchema());
  }

  if (context.resolvedModules.includes("organizations")) {
    await writeTextFile(path.join(appDir, "server/lib/auth/org-context.ts"), buildOrgContext());
    await writeTextFile(path.join(appDir, "server/lib/auth/permissions.ts"), buildPermissions());
  }

  if (context.resolvedModules.includes("stripe")) {
    await ensureDir(path.join(appDir, "server/lib/integrations"));
    await ensureDir(path.join(appDir, "server/lib/billing"));
    await ensureDir(path.join(appDir, "src/routes/api/webhooks"));
    await writeTextFile(
      path.join(appDir, "server/lib/integrations/stripe.ts"),
      buildStripeClient()
    );
    await writeTextFile(path.join(appDir, "server/lib/billing/index.ts"), buildBillingLib());
    await writeTextFile(path.join(appDir, "server/db/schema/billing.ts"), buildBillingSchema());
    await writeTextFile(path.join(appDir, "server/functions/billing.ts"), buildBillingFunctions());
    await writeTextFile(
      path.join(appDir, "src/routes/api/webhooks/stripe.ts"),
      buildStripeWebhookRoute()
    );
  }

  if (context.resolvedModules.includes("storage")) {
    await ensureDir(path.join(appDir, "server/lib/storage"));
    await writeTextFile(path.join(appDir, "server/lib/storage/client.ts"), buildStorageClient());
    await writeTextFile(path.join(appDir, "server/lib/storage/index.ts"), buildStorageIndex());
  }

  if (context.resolvedModules.includes("email")) {
    await ensureDir(path.join(appDir, "server/lib/emails/templates"));
    await ensureDir(path.join(appDir, "server/lib/integrations"));
    await writeTextFile(path.join(appDir, "server/lib/emails/send.ts"), buildEmailSend());
    await writeTextFile(
      path.join(appDir, "server/lib/emails/templates/layout.tsx"),
      buildEmailLayout()
    );
    await writeTextFile(
      path.join(appDir, "server/lib/integrations/resend.ts"),
      buildResendClient()
    );
  }

  if (context.resolvedModules.includes("inngest")) {
    await ensureDir(path.join(appDir, "server/jobs"));
    await writeTextFile(path.join(appDir, "server/lib/inngest.ts"), buildInngestClient());
    await writeTextFile(path.join(appDir, "server/jobs/index.ts"), buildInngestJobsIndex());
    await writeTextFile(path.join(appDir, "server/jobs/example.ts"), buildInngestExampleJob());
    await writeTextFile(path.join(appDir, "src/routes/api/inngest.ts"), buildInngestApiRoute());
  }

  if (context.resolvedModules.includes("observability")) {
    await writeTextFile(path.join(appDir, "server/lib/tracing.ts"), buildTracingLib(context));
    await writeTextFile(path.join(appDir, "server/lib/sentry.ts"), buildSentryLib());
  }

  if (context.resolvedModules.includes("redis")) {
    await ensureDir(path.join(appDir, "server/middleware"));
    await writeTextFile(path.join(appDir, "server/lib/redis.ts"), buildRedisClient());
    await writeTextFile(
      path.join(appDir, "server/middleware/rate-limit.ts"),
      buildRateLimitMiddleware()
    );
  }

  if (context.resolvedModules.includes("storybook")) {
    await ensureDir(path.join(appDir, ".storybook"));
    await writeTextFile(path.join(appDir, ".storybook/main.ts"), buildStorybookMain());
    await writeTextFile(path.join(appDir, ".storybook/preview.tsx"), buildStorybookPreview());
  }
}

// ---------------------------------------------------------------------------
// Root-level builders
// ---------------------------------------------------------------------------

function buildRootPackageJson(context: GenerateContext): PackageJsonShape {
  const base: PackageJsonShape = {
    name: context.projectName,
    private: true,
    workspaces: ["packages/*"],
    scripts: {
      prepare: "husky",
      dev: "turbo run dev --filter=./packages/app",
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
      "@commitlint/cli": "^20.5.0",
      "@commitlint/config-conventional": "^20.5.0",
      "@tanstack/router-plugin": "1.166.12",
      "@testing-library/jest-dom": "^6.9.1",
      "@types/jsdom": "^28.0.0",
      "@types/node": "^25.5.0",
      "@types/react": "19.2.14",
      "@types/react-dom": "19.2.3",
      "@typescript/native-preview": "^7.0.0-dev.20260316.1",
      "@vitest/ui": "4.1.0",
      husky: "9.1.7",
      jsdom: "^28.1.0",
      "lint-staged": "16.4.0",
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
    engines: { node: ">=22.0.0 <25" },
    packageManager: "bun@1.3.4",
  };

  const fragments = context.resolvedModules.map(m => ({
    scripts: MODULE_REGISTRY[m].root?.scripts,
    dependencies: MODULE_REGISTRY[m].root?.dependencies,
    devDependencies: MODULE_REGISTRY[m].root?.devDependencies,
  }));

  return mergePackageJson(base, ...fragments);
}

function buildTurboConfig(context: GenerateContext) {
  const tasks: Record<string, Record<string, unknown>> = {
    build: { dependsOn: ["^build"], outputs: ["dist/**", ".output/**"] },
    dev: { cache: false, persistent: true },
    lint: { dependsOn: ["^lint"] },
    typecheck: { dependsOn: ["^typecheck"] },
    test: { cache: false },
    "db:generate": { cache: false },
    "db:migrate": { cache: false },
  };

  if (context.resolvedModules.includes("storybook")) {
    tasks.storybook = { cache: false, persistent: true };
    tasks["build-storybook"] = { dependsOn: ["^build"], outputs: ["storybook-static/**"] };
  }

  return { $schema: "https://turbo.build/schema.json", tasks };
}

function buildOxlintConfig(context: GenerateContext) {
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
        files: ["packages/app/src/**/*.tsx"],
        rules: {
          [`${context.projectName}-react/max-component-complexity`]: [
            "error",
            { maxHooks: 5, maxHandlers: 3, maxTotal: 7 },
          ],
          [`${context.projectName}-react-hooks/no-mixed-hooks-and-components`]: "warn",
        },
      },
      {
        files: ["packages/app/src/**/*.{ts,tsx}"],
        rules: {
          [`${context.projectName}-react-hooks/hooks-in-hooks-folder`]: "warn",
        },
      },
      {
        files: ["packages/app/src/components/ui/**/*.{ts,tsx}"],
        rules: {
          [`${context.projectName}-react/max-component-complexity`]: "off",
          [`${context.projectName}-react-hooks/no-mixed-hooks-and-components`]: "off",
          [`${context.projectName}-react-hooks/hooks-in-hooks-folder`]: "off",
        },
      },
      {
        files: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}", "**/*.stories.{ts,tsx}"],
        rules: {
          [`${context.projectName}-react/max-component-complexity`]: "off",
          [`${context.projectName}-react-hooks/no-mixed-hooks-and-components`]: "off",
          [`${context.projectName}-react-hooks/hooks-in-hooks-folder`]: "off",
        },
      },
    ],
  });
}

function buildCiWorkflow() {
  const scopes = ["repo", "app", "ui", "auth", "billing", "docs", "test"];
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
    ...scopes.map(s => `            ${s}`),
    "  check:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v5",
    "      - uses: ./.github/actions/setup-bun",
    "      - run: bun install --frozen-lockfile",
    "      - run: make check",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// CLAUDE.md sections
// ---------------------------------------------------------------------------

function buildArchitectureSection(context: GenerateContext): string {
  return replaceTemplateTokens(
    [
      "## Architecture",
      "",
      "**{{projectTitle}}** is a fullstack monorepo using TanStack Start, orchestrated by Turborepo and managed with Bun.",
      "",
      "### Monorepo Structure",
      "",
      "```",
      "packages/",
      "└── app/                 # TanStack Start fullstack app (SSR + Server Functions)",
      "```",
      "",
      "### Path Aliases",
      "",
      "- `~/*` maps to `./` root of the app package",
      "",
      "### App Structure (`packages/app`)",
      "",
      "```",
      "src/",
      "├── client.tsx           # Client-side hydration entry",
      "├── server.ts            # Server entry point",
      "├── router.tsx           # TanStack Router configuration",
      "├── routeTree.gen.ts     # Auto-generated route tree (never edit)",
      "├── routes/              # File-based routes (TanStack Router)",
      "│   ├── __root.tsx       # Root layout",
      "│   ├── _dashboard.tsx   # Dashboard layout",
      "│   └── api/             # API routes (webhooks, health, auth)",
      "├── components/          # React components (ui/, feature-specific/)",
      "├── hooks/               # Shared React hooks",
      "├── stores/              # Zustand stores",
      "└── styles.css           # Tailwind v4 theme",
      "",
      "server/",
      "├── db/                  # Drizzle ORM schema, client",
      "│   ├── index.ts         # Database client",
      "│   └── schema/          # Table definitions",
      "├── lib/                 # Server utilities (errors, env, auth, integrations)",
      "├── functions/           # Server Functions (createServerFn)",
      "├── middleware/          # Composable auth/rate-limit helpers",
      "└── jobs/                # Background jobs (Inngest)",
      "```",
      "",
      "### Data Flow",
      "",
      "- **Client**: TanStack Query for server state; Zustand for shared client state",
      "- **Server**: Server Functions (`createServerFn`) for data mutations and queries",
      "- **API Routes**: Only for webhooks, health checks, and auth handler endpoints",
      "- **Database**: PostgreSQL 16 via Drizzle ORM",
      "",
      "### Tooling",
      "",
      "- **Package manager**: Bun",
      "- **Monorepo orchestration**: Turborepo",
      "- **Framework**: TanStack Start (Vite-based SSR)",
      "- **Linting**: Oxlint",
      "- **Formatting**: Oxfmt (printWidth: 100)",
      "- **Type checking**: tsc",
      "- **Testing**: Vitest + Testing Library",
      "- **Commits**: Conventional Commits + commitlint + husky + lint-staged",
    ].join("\n"),
    context.tokens
  );
}

function buildSkillEnforcementBackend(_context: GenerateContext): string[] {
  return [
    "### Server & Database",
    "",
    "- **Server Functions (createServerFn)**: Use `tanstack-start-best-practices` skill",
    "- **Database/schema/queries**: Use `postgres-drizzle` skill",
    "- **Drizzle ORM patterns**: Use `drizzle-orm` skill",
    "- **Drizzle migrations**: Use `drizzle-safe-migrations` skill",
    "- **Validation (Zod schemas)**: Use `zod` skill",
    "- **Utility functions (es-toolkit)**: Use `es-toolkit` skill",
    "",
  ];
}

function buildServerArchitectureRules(): string {
  return [
    "## Server Architecture Rules",
    "",
    "- Use Server Functions (`createServerFn`) for all data access from routes",
    "- API routes (`src/routes/api/`) are reserved for webhooks, health checks, and third-party integrations",
    "- Server Functions should validate inputs with `.inputValidator()` or Zod schemas",
    "- Repository functions handle all database operations via Drizzle",
    "- Never import server-only code directly in route components — always go through Server Functions",
    "- Never edit files in the `drizzle/` folder (auto-generated)",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// App package.json
// ---------------------------------------------------------------------------

function buildAppPackageJson(context: GenerateContext): PackageJsonShape {
  const base: PackageJsonShape = {
    name: "app",
    private: true,
    type: "module",
    scripts: {
      dev: "vite dev",
      build: "vite build",
      start: "node .output/server/index.mjs",
      test: "bunx vitest run",
      typecheck: "bunx tsgo --noEmit",
      "db:generate": "bunx drizzle-kit generate",
      "db:migrate": "bunx drizzle-kit migrate",
    },
    dependencies: {
      "@base-ui/react": "^1.3.0",
      "@fontsource-variable/geist": "^5.2.8",
      "@fontsource/bricolage-grotesque": "^5.2.10",
      "@hookform/resolvers": "^5.2.2",
      "@logtape/logtape": "^2.0.4",
      "@opentelemetry/api": "^1.9.0",
      "@tabler/icons-react": "^3.40.0",
      "@tanstack/react-query": "^5.90.21",
      "@tanstack/react-query-devtools": "^5.91.3",
      "@tanstack/react-router": "^1.167.3",
      "@tanstack/react-router-devtools": "^1.166.9",
      "@tanstack/react-start": "^1.166.14",
      "class-variance-authority": "^0.7.1",
      clsx: "^2.1.1",
      cmdk: "^1.1.1",
      "date-fns": "^4.1.0",
      "drizzle-orm": "^0.45.1",
      "embla-carousel-react": "^8.6.0",
      "es-toolkit": "^1.45.1",
      "input-otp": "^1.4.2",
      "lucide-react": "^0.577.0",
      "next-themes": "^0.4.6",
      postgres: "^3.4.8",
      react: "^19.2.4",
      "react-day-picker": "^9.14.0",
      "react-dom": "^19.2.4",
      "react-hook-form": "^7.71.2",
      "react-resizable-panels": "^4.7.3",
      recharts: "2.15.4",
      sonner: "^2.0.7",
      "tailwind-merge": "^3.5.0",
      tailwindcss: "^4.2.1",
      "tw-animate-css": "^1.4.0",
      uuid: "^13.0.0",
      vaul: "^1.1.2",
      zod: "^4.3.6",
      zustand: "^5.0.11",
    },
    devDependencies: {
      "@tailwindcss/vite": "^4.2.1",
      "@testing-library/dom": "^10.4.1",
      "@testing-library/react": "^16.3.2",
      "@vitejs/plugin-react": "^6.0.1",
      "drizzle-kit": "^0.31.9",
      dotenv: "^17.3.1",
      "vite-tsconfig-paths": "^6.1.1",
      vitest: "4.1.0",
    },
  };

  const fragments = context.resolvedModules.map(m => {
    const mod = MODULE_REGISTRY[m];
    // Use app-specific contributions if defined, otherwise merge backend + frontend deps
    if (mod.app) {
      return {
        scripts: mod.app.scripts,
        dependencies: mod.app.dependencies,
        devDependencies: mod.app.devDependencies,
      };
    }
    return {
      scripts: { ...mod.frontend?.scripts, ...mod.backend?.scripts },
      dependencies: { ...mod.frontend?.dependencies, ...mod.backend?.dependencies },
      devDependencies: { ...mod.frontend?.devDependencies, ...mod.backend?.devDependencies },
    };
  });

  return mergePackageJson(base, ...fragments);
}

// ---------------------------------------------------------------------------
// App config files
// ---------------------------------------------------------------------------

function buildAppViteConfig() {
  return [
    'import tailwindcss from "@tailwindcss/vite";',
    'import { tanstackStart } from "@tanstack/react-start/plugin/vite";',
    'import viteReact from "@vitejs/plugin-react";',
    'import { defineConfig } from "vite";',
    'import tsConfigPaths from "vite-tsconfig-paths";',
    "",
    "export default defineConfig({",
    "  server: {",
    "    port: 3000,",
    "  },",
    "  plugins: [",
    "    tailwindcss(),",
    '    tsConfigPaths({ projects: ["./tsconfig.json"] }),',
    "    tanstackStart({",
    '      srcDirectory: "src",',
    "    }),",
    "    viteReact(),",
    "  ],",
    "});",
    "",
  ].join("\n");
}

function buildAppTsConfig() {
  return {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      jsx: "react-jsx",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      types: ["vite/client"],
      paths: {
        "@/*": ["./src/*"],
        "~/*": ["./*"],
      },
    },
    include: ["src", "server", "vite.config.ts"],
  };
}

function buildDrizzleConfig() {
  return [
    'import { defineConfig } from "drizzle-kit";',
    "",
    "export default defineConfig({",
    '  schema: "./server/db/schema",',
    '  out: "./server/db/migrations",',
    '  dialect: "postgresql",',
    "  dbCredentials: {",
    "    url: process.env.DATABASE_URL!,",
    "  },",
    "});",
    "",
  ].join("\n");
}

function buildVitestConfig(context: GenerateContext) {
  return replaceTemplateTokens(
    [
      '/// <reference types="vitest" />',
      'import { defineConfig } from "vitest/config";',
      'import tsconfigPaths from "vite-tsconfig-paths";',
      "",
      "export default defineConfig({",
      "  plugins: [tsconfigPaths()],",
      "  test: {",
      '    environment: "jsdom",',
      "    globals: true,",
      '    setupFiles: ["./src/test-setup.ts"],',
      "  },",
      "});",
      "",
    ].join("\n"),
    context.tokens
  );
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

function buildClientEntry() {
  return [
    'import { StartClient } from "@tanstack/react-start/client";',
    'import { StrictMode } from "react";',
    'import { hydrateRoot } from "react-dom/client";',
    "",
    "hydrateRoot(",
    "  document,",
    "  <StrictMode>",
    "    <StartClient />",
    "  </StrictMode>,",
    ");",
    "",
  ].join("\n");
}

function buildServerEntry(context: GenerateContext) {
  const lines = [
    'import { withContext } from "@logtape/logtape";',
    'import handler, { createServerEntry } from "@tanstack/react-start/server-entry";',
    'import { configureBackendLogger, logger } from "~/server/lib/logger.ts";',
    'import { REQUEST_ID_HEADER, resolveRequestId } from "~/server/lib/request-context.ts";',
  ];

  if (context.resolvedModules.includes("observability")) {
    lines.push(
      'import { initializeSentry } from "~/server/lib/sentry.ts";',
      'import { initializeTracing, shutdownTracing } from "~/server/lib/tracing.ts";'
    );
  }

  lines.push("", "configureBackendLogger();", "");

  if (context.resolvedModules.includes("observability")) {
    lines.push(
      "let shutdownHandlersRegistered = false;",
      "const startup = initializeServerRuntime();",
      "",
      "async function initializeServerRuntime() {",
      "  initializeSentry();",
      "  await initializeTracing();",
      "  registerShutdownHandlers();",
      "}",
      "",
      "function registerShutdownHandlers() {",
      '  if (shutdownHandlersRegistered || process.env.NODE_ENV === "test") {',
      "    return;",
      "  }",
      "",
      "  shutdownHandlersRegistered = true;",
      '  for (const signal of ["SIGINT", "SIGTERM"] as const) {',
      "    process.once(signal, () => {",
      "      void shutdownTracing();",
      "    });",
      "  }",
      "}",
      ""
    );
  } else {
    lines.push("const startup = Promise.resolve();", "");
  }

  lines.push(
    "function withRequestIdHeader(response: Response, requestId: string) {",
    "  const headers = new Headers(response.headers);",
    "  headers.set(REQUEST_ID_HEADER, requestId);",
    "  return new Response(response.body, {",
    "    status: response.status,",
    "    statusText: response.statusText,",
    "    headers,",
    "  });",
    "}",
    "",
    "export default createServerEntry({",
    "  async fetch(request) {",
    "    await startup;",
    "",
    '    const requestId = resolveRequestId(request.headers.get("x-request-id"));',
    "    const requestUrl = new URL(request.url);",
    "    const startedAt = performance.now();",
    "",
    "    return withContext({ requestId }, async () => {",
    "      try {",
    "        const response = await handler.fetch(request);",
    "        const responseWithHeaders = withRequestIdHeader(response, requestId);",
    "",
    '        logger.info("HTTP request completed", {',
    "          durationMs: Number((performance.now() - startedAt).toFixed(3)),",
    "          method: request.method,",
    "          path: requestUrl.pathname,",
    "          requestId,",
    "          statusCode: responseWithHeaders.status,",
    "        });",
    "",
    "        return responseWithHeaders;",
    "      } catch (error) {",
    '        logger.error("HTTP request failed", {',
    "          error,",
    "          method: request.method,",
    "          path: requestUrl.pathname,",
    "          requestId,",
    "        });",
    "        throw error;",
    "      }",
    "    });",
    "  },",
    "});",
    ""
  );

  return lines.join("\n");
}

function buildRouterEntry() {
  return [
    'import { createRouter } from "@tanstack/react-router";',
    'import { routeTree } from "./routeTree.gen";',
    "",
    "export function getRouter() {",
    "  const router = createRouter({",
    "    routeTree,",
    "    scrollRestoration: true,",
    '    defaultPreload: "intent",',
    "    defaultStructuralSharing: true,",
    "    defaultPreloadStaleTime: 0,",
    "  });",
    "",
    "  return router;",
    "}",
    "",
    'declare module "@tanstack/react-router" {',
    "  interface Register {",
    "    router: ReturnType<typeof getRouter>;",
    "  }",
    "}",
    "",
  ].join("\n");
}

type TanStackRouteDefinition = {
  filePath: string;
  fileRoutePath: string;
  fileRouteId: string;
  fullPath: string;
  importName: string;
  importPath: string;
  parentRoute: "rootRouteImport" | "DashboardRoute";
  path: string;
};

function buildRouteTree(context: GenerateContext) {
  const routes: TanStackRouteDefinition[] = [
    {
      filePath: "/_dashboard",
      fileRoutePath: "",
      fileRouteId: "/_dashboard",
      fullPath: "/",
      importName: "DashboardRoute",
      importPath: "./routes/_dashboard",
      parentRoute: "rootRouteImport",
      path: "",
    },
    {
      filePath: "/_dashboard/",
      fileRoutePath: "/",
      fileRouteId: "/",
      fullPath: "/",
      importName: "DashboardIndexRoute",
      importPath: "./routes/_dashboard/index",
      parentRoute: "DashboardRoute",
      path: "/",
    },
    {
      filePath: "/api/health",
      fileRoutePath: "/api/health",
      fileRouteId: "/api/health",
      fullPath: "/api/health",
      importName: "ApiHealthRoute",
      importPath: "./routes/api/health",
      parentRoute: "rootRouteImport",
      path: "/api/health",
    },
    {
      filePath: "/_dashboard/settings",
      fileRoutePath: "/settings",
      fileRouteId: "/settings",
      fullPath: "/settings",
      importName: "DashboardSettingsRoute",
      importPath: "./routes/_dashboard/settings",
      parentRoute: "DashboardRoute",
      path: "/settings",
    },
  ];

  if (context.resolvedModules.includes("auth")) {
    routes.push({
      filePath: "/api/auth/$",
      fileRoutePath: "/api/auth/$",
      fileRouteId: "/api/auth/$",
      fullPath: "/api/auth/$",
      importName: "ApiAuthSplatRoute",
      importPath: "./routes/api/auth/$",
      parentRoute: "rootRouteImport",
      path: "/api/auth/$",
    });
  }

  if (context.resolvedModules.includes("stripe")) {
    routes.push({
      filePath: "/api/webhooks/stripe",
      fileRoutePath: "/api/webhooks/stripe",
      fileRouteId: "/api/webhooks/stripe",
      fullPath: "/api/webhooks/stripe",
      importName: "ApiWebhooksStripeRoute",
      importPath: "./routes/api/webhooks/stripe",
      parentRoute: "rootRouteImport",
      path: "/api/webhooks/stripe",
    });
  }

  if (context.resolvedModules.includes("inngest")) {
    routes.push({
      filePath: "/api/inngest",
      fileRoutePath: "/api/inngest",
      fileRouteId: "/api/inngest",
      fullPath: "/api/inngest",
      importName: "ApiInngestRoute",
      importPath: "./routes/api/inngest",
      parentRoute: "rootRouteImport",
      path: "/api/inngest",
    });
  }

  const dashboardLayoutRoute = routes.find(route => route.importName === "DashboardRoute");
  const dashboardChildRoutes = routes.filter(route => route.parentRoute === "DashboardRoute");
  const rootLeafRoutes = routes.filter(
    route => route.parentRoute === "rootRouteImport" && route.importName !== "DashboardRoute"
  );
  const addressableRoutes = routes.filter(route => route.importName !== "DashboardRoute");
  const fileRouteIdEntries = [
    '  "__root__": typeof rootRouteImport;',
    `  "${dashboardLayoutRoute?.filePath}": typeof DashboardRouteWithChildren;`,
    ...addressableRoutes.map(route => `  "${route.filePath}": typeof ${route.importName};`),
  ];
  const fileRouteTypeIds = [
    '"__root__"',
    `"${dashboardLayoutRoute?.filePath}"`,
    ...addressableRoutes.map(route => `"${route.filePath}"`),
  ];
  const fullPaths = Array.from(new Set(addressableRoutes.map(route => route.fullPath)));
  const rootChildren = [
    "DashboardRoute: typeof DashboardRouteWithChildren;",
    ...rootLeafRoutes.map(route => `${route.importName}: typeof ${route.importName};`),
  ];
  const dashboardChildren = dashboardChildRoutes.map(
    route => `${route.importName}: typeof ${route.importName};`
  );

  return [
    "/* eslint-disable */",
    "",
    "// @ts-nocheck",
    "",
    "// noinspection JSUnusedGlobalSymbols",
    "",
    "// This file was automatically generated by Devstack for the initial scaffold.",
    "// TanStack Start may update it during development or build as routes evolve.",
    "",
    'import { Route as rootRouteImport } from "./routes/__root";',
    ...routes.map(
      route => `import { Route as ${route.importName}Import } from "${route.importPath}";`
    ),
    "",
    ...routes.map(route =>
      [
        `const ${route.importName} = ${route.importName}Import.update({`,
        `  id: "${route.fileRouteId}",`,
        route.path ? `  path: "${route.path}",` : undefined,
        `  getParentRoute: () => ${route.parentRoute},`,
        "} as any);",
      ]
        .filter(Boolean)
        .join("\n")
    ),
    "",
    "export interface FileRoutesByFullPath {",
    ...addressableRoutes.map(route => `  "${route.fullPath}": typeof ${route.importName};`),
    "}",
    "export interface FileRoutesByTo {",
    ...addressableRoutes.map(route => `  "${route.fullPath}": typeof ${route.importName};`),
    "}",
    "export interface FileRoutesById {",
    ...fileRouteIdEntries,
    "}",
    "export interface FileRouteTypes {",
    "  fileRoutesByFullPath: FileRoutesByFullPath;",
    `  fullPaths: ${fullPaths.map(fullPath => `"${fullPath}"`).join(" | ")};`,
    "  fileRoutesByTo: FileRoutesByTo;",
    `  to: ${fullPaths.map(fullPath => `"${fullPath}"`).join(" | ")};`,
    `  id: ${fileRouteTypeIds.join(" | ")};`,
    "  fileRoutesById: FileRoutesById;",
    "}",
    "export interface RootRouteChildren {",
    ...rootChildren.map(line => `  ${line}`),
    "}",
    "",
    'declare module "@tanstack/react-router" {',
    "  interface FileRoutesByPath {",
    ...routes.map(route =>
      [
        `    "${route.filePath}": {`,
        `      id: "${route.filePath}",`,
        `      path: "${route.fileRoutePath}",`,
        `      fullPath: "${route.fullPath}",`,
        `      preLoaderRoute: typeof ${route.importName}Import,`,
        `      parentRoute: typeof ${route.parentRoute};`,
        "    };",
      ].join("\n")
    ),
    "  }",
    "}",
    "",
    "interface DashboardRouteChildren {",
    ...dashboardChildren.map(line => `  ${line}`),
    "}",
    "",
    "const DashboardRouteChildren: DashboardRouteChildren = {",
    ...dashboardChildRoutes.map(route => `  ${route.importName}: ${route.importName},`),
    "};",
    "",
    "const DashboardRouteWithChildren = DashboardRoute._addFileChildren(DashboardRouteChildren);",
    "",
    "const rootRouteChildren: RootRouteChildren = {",
    "  DashboardRoute: DashboardRouteWithChildren,",
    ...rootLeafRoutes.map(route => `  ${route.importName}: ${route.importName},`),
    "};",
    "",
    "export const routeTree = rootRouteImport",
    "  ._addFileChildren(rootRouteChildren)",
    "  ._addFileTypes<FileRouteTypes>();",
    "",
    'import type { getRouter } from "./router.tsx";',
    'import type { createStart } from "@tanstack/react-start";',
    "",
    'declare module "@tanstack/react-start" {',
    "  interface Register {",
    "    ssr: true;",
    "    router: Awaited<ReturnType<typeof getRouter>>;",
    "  }",
    "}",
    "",
  ].join("\n");
}

function buildRequestContextLib() {
  return [
    'export const REQUEST_ID_HEADER = "X-Request-Id";',
    "",
    "export function resolveRequestId(headerValue: string | null | undefined) {",
    "  const trimmedValue = headerValue?.trim();",
    "",
    "  if (trimmedValue) {",
    "    return trimmedValue;",
    "  }",
    "",
    "  return crypto.randomUUID();",
    "}",
    "",
  ].join("\n");
}

function buildTestItemFactory() {
  return [
    'import { toMerged } from "es-toolkit/object";',
    'import { items } from "~/server/db/schema/index.ts";',
    "",
    "type NewItem = typeof items.$inferInsert;",
    "",
    "export function createTestItem(overrides: Partial<NewItem> = {}): NewItem {",
    "  return toMerged(",
    "    {",
    '      name: "Test Item",',
    "      description: null,",
    "    } satisfies NewItem,",
    "    overrides",
    "  );",
    "}",
    "",
  ].join("\n");
}

function buildTestUtilsIndex() {
  return [
    'export { getTestDb, setupTestDatabase, teardownTestDatabase, withTestTransaction } from "./db.ts";',
    'export { createTestItem } from "./factories.ts";',
    'export { testRequest } from "./request.ts";',
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

function buildRootRoute(context: GenerateContext) {
  return replaceTemplateTokens(
    [
      '/// <reference types="vite/client" />',
      'import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";',
      'import type { ReactNode } from "react";',
      'import appCss from "~/src/styles.css?url";',
      "",
      'const faviconHref = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2716%27 fill=%27%23131211%27/%3E%3Cpath d=%27M19 21h14c7.18 0 13 5.82 13 13s-5.82 13-13 13H19V21zm13.2 19c3.98 0 7.2-3.22 7.2-7.2s-3.22-7.2-7.2-7.2h-6.8V40h6.8z%27 fill=%27%23F7A94A%27/%3E%3C/svg%3E";',
      "",
      "export const Route = createRootRoute({",
      "  head: () => ({",
      "    meta: [",
      '      { charSet: "utf-8" },',
      '      { name: "viewport", content: "width=device-width, initial-scale=1" },',
      '      { title: "{{projectTitle}}" },',
      "    ],",
      "    links: [",
      '      { rel: "icon", href: faviconHref, type: "image/svg+xml" },',
      '      { rel: "stylesheet", href: appCss },',
      "    ],",
      "  }),",
      "  shellComponent: RootDocument,",
      "  component: RootComponent,",
      "});",
      "",
      "function RootComponent() {",
      "  return <Outlet />;",
      "}",
      "",
      "function RootDocument({ children }: Readonly<{ children: ReactNode }>) {",
      "  return (",
      '    <html lang="en">',
      "      <head>",
      "        <HeadContent />",
      "      </head>",
      "      <body>",
      "        {children}",
      "        <Scripts />",
      "      </body>",
      "    </html>",
      "  );",
      "}",
      "",
    ].join("\n"),
    context.tokens
  );
}

function buildDashboardLayout(context: GenerateContext) {
  return replaceTemplateTokens(
    [
      'import { Outlet, createFileRoute } from "@tanstack/react-router";',
      'import { SidebarInset, SidebarProvider } from "~/src/components/ui/sidebar";',
      'import { AppSidebar } from "~/src/components/app-sidebar";',
      "",
      'export const Route = createFileRoute("/_dashboard")({',
      "  component: DashboardLayout,",
      "});",
      "",
      "function DashboardLayout() {",
      "  return (",
      "    <SidebarProvider>",
      "      <AppSidebar />",
      "      <SidebarInset>",
      "        <Outlet />",
      "      </SidebarInset>",
      "    </SidebarProvider>",
      "  );",
      "}",
      "",
    ].join("\n"),
    context.tokens
  );
}

function buildDashboardIndex(context: GenerateContext) {
  return replaceTemplateTokens(
    [
      'import { createFileRoute } from "@tanstack/react-router";',
      "",
      'export const Route = createFileRoute("/_dashboard/")({',
      "  component: DashboardIndex,",
      "});",
      "",
      "function DashboardIndex() {",
      "  return (",
      '    <div className="flex flex-1 flex-col gap-4 p-4">',
      '      <h1 className="text-2xl font-bold font-display">Welcome to {{projectTitle}}</h1>',
      '      <p className="text-muted-foreground">Your dashboard is ready.</p>',
      "    </div>",
      "  );",
      "}",
      "",
    ].join("\n"),
    context.tokens
  );
}

function buildSettingsPage() {
  return [
    'import { createFileRoute } from "@tanstack/react-router";',
    "",
    'export const Route = createFileRoute("/_dashboard/settings")({',
    "  component: SettingsPage,",
    "});",
    "",
    "function SettingsPage() {",
    "  return (",
    '    <div className="flex flex-1 flex-col gap-4 p-4">',
    '      <h1 className="text-2xl font-bold font-display">Settings</h1>',
    '      <p className="text-muted-foreground">Manage your application settings here.</p>',
    "    </div>",
    "  );",
    "}",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Styles, stores, integrations
// ---------------------------------------------------------------------------

function buildStyles() {
  return [
    '@import "tailwindcss";',
    '@import "tw-animate-css";',
    '@import "@fontsource-variable/geist";',
    '@import "@fontsource/bricolage-grotesque/500.css";',
    '@import "@fontsource/bricolage-grotesque/700.css";',
    "",
    "@custom-variant dark (&:is(.dark *));",
    "",
    ":root {",
    "  --background: oklch(0.99 0.01 95);",
    "  --foreground: oklch(0.22 0.02 95);",
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
    "  --card: oklch(0.995 0.008 95);",
    "  --card-foreground: oklch(0.22 0.02 95);",
    "  --popover: oklch(0.995 0.008 95);",
    "  --popover-foreground: oklch(0.22 0.02 95);",
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
    "  --card: oklch(0.22 0.01 92);",
    "  --card-foreground: oklch(0.98 0.01 95);",
    "  --popover: oklch(0.22 0.01 92);",
    "  --popover-foreground: oklch(0.98 0.01 95);",
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
    "  --color-card: var(--card);",
    "  --color-card-foreground: var(--card-foreground);",
    "  --color-popover: var(--popover);",
    "  --color-popover-foreground: var(--popover-foreground);",
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
    "  body {",
    "    @apply bg-background font-sans text-foreground antialiased;",
    "  }",
    "}",
    "",
  ].join("\n");
}

function buildThemeStore(context: GenerateContext) {
  return replaceTemplateTokens(
    [
      'import { create } from "zustand";',
      'import { createJSONStorage, persist } from "zustand/middleware";',
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
      "export const useThemeStore = create<ThemeState>()(persist(",
      "  (set) => ({",
      '    theme: "system",',
      "    setTheme: (theme) => {",
      "      applyTheme(theme);",
      "      set({ theme });",
      "    },",
      "  }),",
      "  {",
      '    name: "{{projectName}}-theme",',
      "    storage: createJSONStorage(() => localStorage),",
      "    onRehydrateStorage: () => (state) => {",
      '      if (state) applyTheme(state.theme ?? "system");',
      "    },",
      "  },",
      "));",
      "",
    ].join("\n"),
    context.tokens
  );
}

function buildQueryProvider() {
  return [
    'import { QueryClient, QueryClientProvider } from "@tanstack/react-query";',
    'import { ReactQueryDevtools } from "@tanstack/react-query-devtools";',
    'import type { ReactNode } from "react";',
    "",
    "const queryClient = new QueryClient({",
    "  defaultOptions: {",
    "    queries: {",
    "      staleTime: 1000 * 60,",
    "      retry: 1,",
    "    },",
    "  },",
    "});",
    "",
    "export function QueryProvider({ children }: { children: ReactNode }) {",
    "  return (",
    "    <QueryClientProvider client={queryClient}>",
    "      {children}",
    "      <ReactQueryDevtools />",
    "    </QueryClientProvider>",
    "  );",
    "}",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Server files
// ---------------------------------------------------------------------------

function buildDbIndex() {
  return [
    'import { drizzle } from "drizzle-orm/postgres-js";',
    'import postgres from "postgres";',
    'import * as schema from "./schema/index.ts";',
    "",
    "const connectionString = process.env.DATABASE_URL!;",
    "const client = postgres(connectionString, {",
    "  onnotice: () => {},",
    "});",
    "export const db = drizzle(client, { schema });",
    "export type Database = typeof db;",
    "",
  ].join("\n");
}

function buildDbSchemaIndex(context: GenerateContext) {
  const exports = ['export * from "./items.ts";'];
  if (context.resolvedModules.includes("auth")) {
    exports.push('export * from "./auth.ts";');
  }
  if (context.resolvedModules.includes("stripe")) {
    exports.push('export * from "./billing.ts";');
  }
  return exports.join("\n") + "\n";
}

function buildItemsSchema() {
  return [
    'import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";',
    "",
    'export const items = pgTable("items", {',
    '  id: uuid("id").defaultRandom().primaryKey(),',
    '  name: text("name").notNull(),',
    '  description: text("description"),',
    '  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),',
    '  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),',
    "});",
    "",
  ].join("\n");
}

function buildEnvTs(context: GenerateContext) {
  const fields: string[] = [
    "  DATABASE_URL: z.string().url(),",
    "  DATABASE_URL_TEST: z.string().url().optional(),",
    '  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),',
    "  PORT: z.coerce.number().default(3000),",
    '  APP_URL: z.string().url().default("http://localhost:3000"),',
    '  LOG_FORMAT: z.enum(["json", "text"]).optional(),',
    '  LOG_LEVEL: z.enum(["debug", "error", "info"]).optional(),',
  ];

  if (context.resolvedModules.includes("auth")) {
    fields.push("  BETTER_AUTH_SECRET: z.string(),");
    fields.push('  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),');
  }
  if (context.resolvedModules.includes("stripe")) {
    fields.push("  STRIPE_SECRET_KEY: z.string(),");
    fields.push("  STRIPE_WEBHOOK_SECRET: z.string(),");
  }
  if (context.resolvedModules.includes("storage")) {
    fields.push("  S3_ENDPOINT: z.string().url(),");
    fields.push("  S3_ACCESS_KEY_ID: z.string(),");
    fields.push("  S3_SECRET_ACCESS_KEY: z.string(),");
    fields.push('  S3_BUCKET: z.string().default("uploads"),');
    fields.push('  S3_REGION: z.string().default("us-east-1"),');
  }
  if (context.resolvedModules.includes("email")) {
    fields.push("  RESEND_API_KEY: z.string(),");
    fields.push('  EMAIL_FROM: z.string().default("noreply@example.com"),');
  }
  if (context.resolvedModules.includes("inngest")) {
    fields.push("  INNGEST_EVENT_KEY: z.string().optional(),");
    fields.push("  INNGEST_SIGNING_KEY: z.string().optional(),");
  }
  if (context.resolvedModules.includes("observability")) {
    fields.push("  SENTRY_DSN: z.string().url().optional(),");
    fields.push("  SENTRY_ENVIRONMENT: z.string().optional(),");
    fields.push("  SENTRY_RELEASE: z.string().optional(),");
    fields.push("  SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),");
    fields.push('  TRACING_ENABLED: z.enum(["0", "1"]).optional(),');
    fields.push('  OTEL_TRACES_ENABLED: z.enum(["0", "1"]).optional(),');
    fields.push("  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),");
    fields.push("  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.string().url().optional(),");
    fields.push("  OTEL_SERVICE_NAME: z.string().optional(),");
    fields.push("  OTEL_SERVICE_VERSION: z.string().optional(),");
  }
  if (context.resolvedModules.includes("inngest")) {
    fields.push("  INNGEST_BASE_URL: z.string().url().optional(),");
    fields.push('  INNGEST_DEV: z.enum(["0", "1"]).optional(),');
  }
  if (context.resolvedModules.includes("redis")) {
    fields.push('  REDIS_URL: z.string().default("redis://localhost:6379"),');
    fields.push("  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),");
    fields.push(
      "  RATE_LIMIT_AUTHENTICATED_LIMIT: z.coerce.number().int().positive().default(300),"
    );
    fields.push("  RATE_LIMIT_PUBLIC_LIMIT: z.coerce.number().int().positive().default(30),");
    fields.push("  RATE_LIMIT_WEBHOOK_LIMIT: z.coerce.number().int().positive().default(120),");
  }

  return [
    'import { z } from "zod";',
    "",
    "const envSchema = z.object({",
    ...fields,
    "});",
    "",
    "export const env = envSchema.parse(process.env);",
    "",
  ].join("\n");
}

function buildItemsFunctions() {
  return [
    'import { createServerFn } from "@tanstack/react-start";',
    'import { eq } from "drizzle-orm";',
    'import { db } from "~/server/db/index.ts";',
    'import { items } from "~/server/db/schema/index.ts";',
    "",
    'export const listItems = createServerFn({ method: "GET" }).handler(async () => {',
    "  return db.select().from(items).orderBy(items.createdAt);",
    "});",
    "",
    'export const getItem = createServerFn({ method: "GET" })',
    "  .inputValidator((id: string) => id)",
    "  .handler(async ({ data: id }) => {",
    "    const [item] = await db.select().from(items).where(eq(items.id, id));",
    "    return item ?? null;",
    "  });",
    "",
    'export const createItem = createServerFn({ method: "POST" })',
    "  .inputValidator((input: { name: string; description?: string }) => input)",
    "  .handler(async ({ data }) => {",
    "    const [item] = await db.insert(items).values(data).returning();",
    "    return item;",
    "  });",
    "",
  ].join("\n");
}

function buildHealthApiRoute(context: GenerateContext) {
  const lines = [
    'import { sql } from "drizzle-orm";',
    'import { createFileRoute } from "@tanstack/react-router";',
    'import { db } from "~/server/db/index.ts";',
  ];

  if (context.resolvedModules.includes("redis")) {
    lines.push('import { getRedisClient } from "~/server/lib/redis.ts";');
  }

  lines.push(
    "",
    "const READINESS_TIMEOUT_MS = 5_000;",
    "",
    "function withReadinessTimeout<T>(label: string, task: () => Promise<T>) {",
    "  let timeoutId: ReturnType<typeof setTimeout> | undefined;",
    "",
    "  const timeoutPromise = new Promise<never>((_, reject) => {",
    "    timeoutId = setTimeout(() => {",
    "      reject(new Error(`${label} readiness check timed out after ${READINESS_TIMEOUT_MS}ms`));",
    "    }, READINESS_TIMEOUT_MS);",
    "",
    "    timeoutId.unref?.();",
    "  });",
    "",
    "  return Promise.race([task(), timeoutPromise]).finally(() => {",
    "    if (timeoutId) {",
    "      clearTimeout(timeoutId);",
    "    }",
    "  });",
    "}",
    "",
    "async function checkPostgresReadiness() {",
    '  await withReadinessTimeout("postgres", async () => {',
    "    await db.execute(sql`select 1`);",
    "  });",
    "}",
    ""
  );

  if (context.resolvedModules.includes("redis")) {
    lines.push(
      "async function checkRedisReadiness() {",
      '  await withReadinessTimeout("redis", async () => {',
      "    const pong = await getRedisClient().ping();",
      '    if (pong !== "PONG") {',
      '      throw new Error("Redis did not respond with PONG");',
      "    }",
      "  });",
      "}",
      ""
    );
  }

  lines.push(
    'export const Route = createFileRoute("/api/health")({',
    "  server: {",
    "    handlers: {",
    "      GET: async () => {",
    "        const timestamp = new Date().toISOString();",
    "",
    '        const checks: Record<string, "ok" | "error"> = {',
    '          postgres: "ok",'
  );

  if (context.resolvedModules.includes("redis")) {
    lines.push('          redis: "ok",');
  }

  lines.push(
    "        };",
    "",
    "        try {",
    "          await checkPostgresReadiness();",
    "        } catch {",
    '          checks.postgres = "error";',
    "        }",
    ""
  );

  if (context.resolvedModules.includes("redis")) {
    lines.push(
      "        try {",
      "          await checkRedisReadiness();",
      "        } catch {",
      '          checks.redis = "error";',
      "        }",
      ""
    );
  }

  lines.push(
    '        if (Object.values(checks).every(status => status === "ok")) {',
    "          return Response.json({",
    '            status: "ready",',
    "            checks,",
    "            timestamp,",
    "          });",
    "        }",
    "",
    "        return Response.json(",
    "          {",
    '            status: "not_ready",',
    "            checks,",
    "            timestamp,",
    "          },",
    "          { status: 503 }",
    "        );",
    "      },",
    "    },",
    "  },",
    "});",
    ""
  );

  return replaceTemplateTokens(lines.join("\n"), context.tokens);
}

function buildEnvExample(context: GenerateContext) {
  const lines = [
    "# App",
    "APP_URL=http://localhost:3000",
    "PORT=3000",
    "NODE_ENV=development",
    "LOG_FORMAT=text",
    "LOG_LEVEL=info",
    "",
    "# Database",
    `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${context.projectName}`,
    `DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/${context.projectName}_test`,
    "",
  ];

  if (context.resolvedModules.includes("auth")) {
    lines.push(
      "# Auth",
      "BETTER_AUTH_SECRET=change-me-to-a-random-secret",
      "BETTER_AUTH_URL=http://localhost:3000",
      ""
    );
  }
  if (context.resolvedModules.includes("stripe")) {
    lines.push("# Stripe", "STRIPE_SECRET_KEY=sk_test_...", "STRIPE_WEBHOOK_SECRET=whsec_...", "");
  }
  if (context.resolvedModules.includes("storage")) {
    lines.push(
      "# Storage",
      "S3_ENDPOINT=http://localhost:9000",
      "S3_ACCESS_KEY_ID=minioadmin",
      "S3_SECRET_ACCESS_KEY=minioadmin",
      "S3_BUCKET=uploads",
      "S3_REGION=us-east-1",
      ""
    );
  }
  if (context.resolvedModules.includes("email")) {
    lines.push("# Email", "RESEND_API_KEY=re_...", "EMAIL_FROM=noreply@example.com", "");
  }
  if (context.resolvedModules.includes("inngest")) {
    lines.push(
      "# Inngest",
      "INNGEST_EVENT_KEY=",
      "INNGEST_SIGNING_KEY=",
      "INNGEST_BASE_URL=http://localhost:8288",
      "INNGEST_DEV=1",
      ""
    );
  }
  if (context.resolvedModules.includes("observability")) {
    lines.push(
      "# Observability",
      "SENTRY_DSN=",
      "SENTRY_ENVIRONMENT=development",
      "SENTRY_RELEASE=",
      "SENTRY_TRACES_SAMPLE_RATE=0.1",
      "TRACING_ENABLED=0",
      "OTEL_TRACES_ENABLED=0",
      "OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317",
      `OTEL_SERVICE_NAME=${context.projectName}-backend`,
      "OTEL_SERVICE_VERSION=",
      ""
    );
  }
  if (context.resolvedModules.includes("redis")) {
    lines.push(
      "# Redis",
      "REDIS_URL=redis://localhost:6379",
      "RATE_LIMIT_WINDOW_MS=60000",
      "RATE_LIMIT_AUTHENTICATED_LIMIT=300",
      "RATE_LIMIT_PUBLIC_LIMIT=30",
      "RATE_LIMIT_WEBHOOK_LIMIT=120",
      ""
    );
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Module: Auth
// ---------------------------------------------------------------------------

function buildAuthConfig(context: GenerateContext) {
  const hasOrgs = context.resolvedModules.includes("organizations");
  return [
    'import { betterAuth } from "better-auth";',
    'import { drizzleAdapter } from "better-auth/adapters/drizzle";',
    hasOrgs ? 'import { organization } from "better-auth/plugins";' : "",
    'import { db } from "~/server/db/index.ts";',
    "",
    "export const auth = betterAuth({",
    '  database: drizzleAdapter(db, { provider: "pg" }),',
    "  emailAndPassword: { enabled: true },",
    hasOrgs ? "  plugins: [organization()]," : "",
    "});",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildAuthMiddleware() {
  return [
    'import { auth } from "~/server/lib/auth/auth.ts";',
    'import { UnauthorizedError } from "~/server/lib/errors.ts";',
    "",
    "export type AuthContext = {",
    '  user: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["user"];',
    '  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["session"];',
    "};",
    "",
    "export async function getAuthContext(request: Request): Promise<AuthContext | null> {",
    "  const result = await auth.api.getSession({ headers: request.headers });",
    "  if (!result) return null;",
    "  return { user: result.user, session: result.session };",
    "}",
    "",
    "export async function requireAuth(request: Request): Promise<AuthContext> {",
    "  const ctx = await getAuthContext(request);",
    '  if (!ctx) throw new UnauthorizedError("Authentication required");',
    "  return ctx;",
    "}",
    "",
  ].join("\n");
}

function buildAuthApiRoute() {
  return [
    'import { createFileRoute } from "@tanstack/react-router";',
    'import { auth } from "~/server/lib/auth/auth.ts";',
    "",
    'export const Route = createFileRoute("/api/auth/$")({',
    "  handler: async ({ request }) => {",
    "    return auth.handler(request);",
    "  },",
    "});",
    "",
  ].join("\n");
}

function buildAuthSchema() {
  return [
    'import { pgTable, text, timestamp, boolean, uuid } from "drizzle-orm/pg-core";',
    "",
    'export const user = pgTable("user", {',
    '  id: uuid("id").defaultRandom().primaryKey(),',
    '  name: text("name").notNull(),',
    '  email: text("email").notNull().unique(),',
    '  emailVerified: boolean("email_verified").notNull().default(false),',
    '  image: text("image"),',
    '  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),',
    '  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),',
    "});",
    "",
    'export const session = pgTable("session", {',
    '  id: uuid("id").defaultRandom().primaryKey(),',
    '  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),',
    '  token: text("token").notNull().unique(),',
    '  ipAddress: text("ip_address"),',
    '  userAgent: text("user_agent"),',
    '  userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),',
    '  activeOrganizationId: text("active_organization_id"),',
    '  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),',
    '  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),',
    "});",
    "",
    'export const account = pgTable("account", {',
    '  id: uuid("id").defaultRandom().primaryKey(),',
    '  accountId: text("account_id").notNull(),',
    '  providerId: text("provider_id").notNull(),',
    '  userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),',
    '  accessToken: text("access_token"),',
    '  refreshToken: text("refresh_token"),',
    '  idToken: text("id_token"),',
    '  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),',
    '  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),',
    '  scope: text("scope"),',
    '  password: text("password"),',
    '  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),',
    '  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),',
    "});",
    "",
    'export const verification = pgTable("verification", {',
    '  id: uuid("id").defaultRandom().primaryKey(),',
    '  identifier: text("identifier").notNull(),',
    '  value: text("value").notNull(),',
    '  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),',
    '  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),',
    '  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),',
    "});",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Module: Organizations
// ---------------------------------------------------------------------------

function buildOrgContext() {
  return [
    'import type { AuthContext } from "~/server/middleware/auth.ts";',
    'import { ValidationError } from "~/server/lib/errors.ts";',
    "",
    "export function getOrgId(ctx: AuthContext, orgIdHeader?: string | null): string {",
    "  if (orgIdHeader) return orgIdHeader;",
    "  const orgId = ctx.session.activeOrganizationId;",
    '  if (!orgId) throw new ValidationError("No active organization");',
    "  return orgId;",
    "}",
    "",
  ].join("\n");
}

function buildPermissions() {
  return [
    'export type Role = "owner" | "admin" | "member";',
    'export type Resource = "billing" | "members" | "settings";',
    'export type Action = "read" | "write" | "delete";',
    "",
    "const PERMISSIONS: Record<Role, Record<Resource, Action[]>> = {",
    '  owner: { billing: ["read", "write", "delete"], members: ["read", "write", "delete"], settings: ["read", "write", "delete"] },',
    '  admin: { billing: ["read", "write"], members: ["read", "write"], settings: ["read", "write"] },',
    '  member: { billing: ["read"], members: ["read"], settings: ["read"] },',
    "};",
    "",
    "export function hasPermission(role: Role, resource: Resource, action: Action): boolean {",
    "  return PERMISSIONS[role]?.[resource]?.includes(action) ?? false;",
    "}",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Module: Stripe (stubs)
// ---------------------------------------------------------------------------

function buildStripeClient() {
  return [
    'import Stripe from "stripe";',
    "",
    "export function getStripeClient() {",
    '  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-04-30.basil" });',
    "}",
    "",
  ].join("\n");
}

function buildBillingLib() {
  return [
    'export { getStripeClient } from "~/server/lib/integrations/stripe.ts";',
    "",
    "// Add billing logic here (checkout sessions, subscription management, etc.)",
    "",
  ].join("\n");
}

function buildBillingSchema() {
  return [
    'import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";',
    'import { user } from "./auth.ts";',
    "",
    'export const subscriptions = pgTable("subscriptions", {',
    '  id: uuid("id").defaultRandom().primaryKey(),',
    '  userId: uuid("user_id").notNull().references(() => user.id),',
    '  stripeSubscriptionId: text("stripe_subscription_id").unique(),',
    '  stripeCustomerId: text("stripe_customer_id"),',
    '  status: text("status").notNull(),',
    '  planId: text("plan_id"),',
    '  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),',
    '  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),',
    "});",
    "",
  ].join("\n");
}

function buildBillingFunctions() {
  return [
    'import { createServerFn } from "@tanstack/react-start";',
    'import { getStripeClient } from "~/server/lib/integrations/stripe.ts";',
    "",
    'export const createCheckoutSession = createServerFn({ method: "POST" })',
    "  .inputValidator((input: { priceId: string; successUrl: string; cancelUrl: string }) => input)",
    "  .handler(async ({ data }) => {",
    "    const stripe = getStripeClient();",
    "    const session = await stripe.checkout.sessions.create({",
    '      mode: "subscription",',
    "      line_items: [{ price: data.priceId, quantity: 1 }],",
    "      success_url: data.successUrl,",
    "      cancel_url: data.cancelUrl,",
    "    });",
    "    return { url: session.url };",
    "  });",
    "",
  ].join("\n");
}

function buildStripeWebhookRoute() {
  return [
    'import { createFileRoute } from "@tanstack/react-router";',
    'import { getStripeClient } from "~/server/lib/integrations/stripe.ts";',
    "",
    'export const Route = createFileRoute("/api/webhooks/stripe")({',
    "  handler: async ({ request }) => {",
    "    const rawBody = await request.text();",
    '    const signature = request.headers.get("stripe-signature");',
    "    if (!signature) {",
    '      return Response.json({ error: "Missing signature" }, { status: 400 });',
    "    }",
    "",
    "    const stripe = getStripeClient();",
    "    const event = stripe.webhooks.constructEvent(",
    "      rawBody,",
    "      signature,",
    "      process.env.STRIPE_WEBHOOK_SECRET!,",
    "    );",
    "",
    "    // Handle event types",
    "    switch (event.type) {",
    '      case "checkout.session.completed":',
    "        // Handle checkout completion",
    "        break;",
    '      case "customer.subscription.updated":',
    "        // Handle subscription update",
    "        break;",
    "    }",
    "",
    "    return Response.json({ received: true });",
    "  },",
    "});",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Module: Storage
// ---------------------------------------------------------------------------

function buildStorageClient() {
  return [
    'import { S3Client } from "@aws-sdk/client-s3";',
    "",
    "export function getS3Client() {",
    "  return new S3Client({",
    "    endpoint: process.env.S3_ENDPOINT,",
    "    region: process.env.S3_REGION,",
    "    credentials: {",
    "      accessKeyId: process.env.S3_ACCESS_KEY_ID!,",
    "      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,",
    "    },",
    "    forcePathStyle: true,",
    "  });",
    "}",
    "",
  ].join("\n");
}

function buildStorageIndex() {
  return [
    'export { getS3Client } from "./client.ts";',
    "",
    "// Add presigned URL helpers, upload/download utilities here",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Module: Email
// ---------------------------------------------------------------------------

function buildEmailSend() {
  return [
    'import { getResendClient } from "~/server/lib/integrations/resend.ts";',
    "",
    "export async function sendEmail(options: {",
    "  to: string;",
    "  subject: string;",
    "  html: string;",
    "}) {",
    "  const resend = getResendClient();",
    "  return resend.emails.send({",
    "    from: process.env.EMAIL_FROM!,",
    "    ...options,",
    "  });",
    "}",
    "",
  ].join("\n");
}

function buildEmailLayout() {
  return [
    "export function EmailLayout({ children }: { children: React.ReactNode }) {",
    "  return (",
    '    <div style={{ fontFamily: "system-ui, sans-serif", padding: "20px" }}>',
    "      {children}",
    "    </div>",
    "  );",
    "}",
    "",
  ].join("\n");
}

function buildResendClient() {
  return [
    'import { Resend } from "resend";',
    "",
    "export function getResendClient() {",
    "  return new Resend(process.env.RESEND_API_KEY);",
    "}",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Module: Inngest
// ---------------------------------------------------------------------------

function buildInngestClient() {
  return [
    'import { Inngest } from "inngest";',
    "",
    'export const inngest = new Inngest({ id: "app" });',
    "",
  ].join("\n");
}

function buildInngestJobsIndex() {
  return [
    'import { exampleJob } from "./example.ts";',
    "",
    "export const functions = [exampleJob];",
    "",
  ].join("\n");
}

function buildInngestExampleJob() {
  return [
    'import { inngest } from "~/server/lib/inngest.ts";',
    "",
    "export const exampleJob = inngest.createFunction(",
    '  { id: "example-job" },',
    '  { event: "app/example.run" },',
    "  async ({ event, step }) => {",
    '    await step.run("process", async () => {',
    "      // your job logic here",
    "      return { success: true };",
    "    });",
    "  },",
    ");",
    "",
  ].join("\n");
}

function buildInngestApiRoute() {
  return [
    'import { createFileRoute } from "@tanstack/react-router";',
    'import { serve } from "inngest/express";',
    'import { inngest } from "~/server/lib/inngest.ts";',
    'import { functions } from "~/server/jobs/index.ts";',
    "",
    "const inngestHandler = serve({ client: inngest, functions });",
    "",
    'export const Route = createFileRoute("/api/inngest")({',
    "  handler: async ({ request }) => {",
    "    // Inngest needs the standard handler",
    "    return inngestHandler(request);",
    "  },",
    "});",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Module: Observability
// ---------------------------------------------------------------------------

function buildTracingLib(context: GenerateContext) {
  return replaceTemplateTokens(
    [
      'import { trace } from "@opentelemetry/api";',
      'import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";',
      'import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";',
      'import { resourceFromAttributes } from "@opentelemetry/resources";',
      'import { NodeSDK } from "@opentelemetry/sdk-node";',
      'import { BatchSpanProcessor, SimpleSpanProcessor, type SpanExporter, type SpanProcessor } from "@opentelemetry/sdk-trace-base";',
      'import { z } from "zod";',
      "",
      'const DEFAULT_OTEL_EXPORTER_URL = "http://localhost:4317";',
      'const DEFAULT_SERVICE_NAME = "{{projectName}}-backend";',
      'const TRACER_NAME = "{{projectName}}-backend";',
      "",
      "const tracingEnvironmentSchema = z.object({",
      "  NODE_ENV: z.string().trim().min(1).optional(),",
      "  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.string().trim().url().optional(),",
      "  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().trim().url().optional(),",
      "  OTEL_SERVICE_NAME: z.string().trim().min(1).optional(),",
      "  OTEL_SERVICE_VERSION: z.string().trim().min(1).optional(),",
      '  OTEL_TRACES_ENABLED: z.enum(["0", "1"]).optional(),',
      '  TRACING_ENABLED: z.enum(["0", "1"]).optional(),',
      "  SENTRY_RELEASE: z.string().trim().min(1).optional(),",
      "});",
      "",
      "type TracingRawEnv = Record<string, string | undefined>;",
      "",
      "export interface TracingEnvironment {",
      "  enabled: boolean;",
      "  environment: string;",
      "  exporterUrl: string;",
      "  serviceName: string;",
      "  serviceVersion?: string;",
      "}",
      "",
      "interface CreateTracingSdkOptions {",
      "  rawEnv?: TracingRawEnv;",
      "  spanProcessors?: SpanProcessor[];",
      "  traceExporter?: SpanExporter;",
      "}",
      "",
      "let tracingSdk: NodeSDK | null = null;",
      "",
      "function getEnvironmentName(rawValue: string | undefined) {",
      '  return rawValue || "development";',
      "}",
      "",
      "export function getTracer() {",
      "  return trace.getTracer(TRACER_NAME);",
      "}",
      "",
      "export function resolveTracingEnvironment(rawEnv: TracingRawEnv = process.env): TracingEnvironment {",
      "  const parsedEnv = tracingEnvironmentSchema.parse(rawEnv);",
      "  const environment = getEnvironmentName(parsedEnv.NODE_ENV);",
      "",
      "  return {",
      "    enabled:",
      '      parsedEnv.TRACING_ENABLED !== "0" &&',
      '      parsedEnv.OTEL_TRACES_ENABLED !== "0" &&',
      '      environment !== "test",',
      "    environment,",
      "    exporterUrl:",
      "      parsedEnv.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??",
      "      parsedEnv.OTEL_EXPORTER_OTLP_ENDPOINT ??",
      "      DEFAULT_OTEL_EXPORTER_URL,",
      "    serviceName: parsedEnv.OTEL_SERVICE_NAME ?? DEFAULT_SERVICE_NAME,",
      "    serviceVersion: parsedEnv.OTEL_SERVICE_VERSION ?? parsedEnv.SENTRY_RELEASE,",
      "  };",
      "}",
      "",
      "export function createTracingSdk(options: CreateTracingSdkOptions = {}) {",
      "  const environment = resolveTracingEnvironment(options.rawEnv);",
      "  const traceExporter =",
      "    options.traceExporter ??",
      "    new OTLPTraceExporter({",
      "      url: environment.exporterUrl,",
      "    });",
      "  const spanProcessors = options.spanProcessors ?? [",
      "    options.traceExporter",
      "      ? new SimpleSpanProcessor(traceExporter)",
      "      : new BatchSpanProcessor(traceExporter),",
      "  ];",
      "",
      "  return new NodeSDK({",
      "    autoDetectResources: false,",
      "    resource: resourceFromAttributes({",
      '      "deployment.environment.name": environment.environment,',
      '      "service.name": environment.serviceName,',
      "      ...(environment.serviceVersion",
      "        ? {",
      '            "service.version": environment.serviceVersion,',
      "          }",
      "        : {}),",
      "    }),",
      "    spanProcessors,",
      "    instrumentations: [new HttpInstrumentation()],",
      "  });",
      "}",
      "",
      "export async function initializeTracing(",
      "  rawEnv: TracingRawEnv = process.env,",
      '  options: Omit<CreateTracingSdkOptions, "rawEnv"> = {}',
      ") {",
      "  const environment = resolveTracingEnvironment(rawEnv);",
      "",
      "  if (!environment.enabled) {",
      "    return false;",
      "  }",
      "",
      "  if (tracingSdk) {",
      "    return true;",
      "  }",
      "",
      "  tracingSdk = createTracingSdk({",
      "    ...options,",
      "    rawEnv,",
      "  });",
      "  await tracingSdk.start();",
      "  return true;",
      "}",
      "",
      "export async function shutdownTracing() {",
      "  if (!tracingSdk) {",
      "    return;",
      "  }",
      "",
      "  const sdk = tracingSdk;",
      "  tracingSdk = null;",
      "  await sdk.shutdown();",
      "}",
      "",
      "export async function shutdownTracingForTests() {",
      "  await shutdownTracing();",
      "}",
      "",
    ].join("\n"),
    context.tokens
  );
}

function buildSentryLib() {
  return [
    'import * as Sentry from "@sentry/bun";',
    "",
    "interface SentryRawEnv {",
    "  NODE_ENV?: string;",
    "  SENTRY_DSN?: string;",
    "  SENTRY_ENVIRONMENT?: string;",
    "  SENTRY_RELEASE?: string;",
    "  SENTRY_TRACES_SAMPLE_RATE?: string;",
    "}",
    "",
    "let isSentryInitialized = false;",
    "",
    "function parseTracesSampleRate(rawValue: string | undefined) {",
    "  if (!rawValue) {",
    "    return 0.1;",
    "  }",
    "",
    "  const parsedValue = Number(rawValue);",
    "",
    "  return Number.isFinite(parsedValue) && parsedValue >= 0 && parsedValue <= 1 ? parsedValue : 0.1;",
    "}",
    "",
    "export function initializeSentry(rawEnv: SentryRawEnv = process.env) {",
    "  const dsn = rawEnv.SENTRY_DSN?.trim();",
    "",
    "  if (!dsn || isSentryInitialized) {",
    "    return Boolean(dsn);",
    "  }",
    "",
    "  Sentry.init({",
    "    dsn,",
    "    enabled: true,",
    '    environment: rawEnv.SENTRY_ENVIRONMENT ?? rawEnv.NODE_ENV ?? "development",',
    "    release: rawEnv.SENTRY_RELEASE,",
    "    tracesSampleRate: parseTracesSampleRate(rawEnv.SENTRY_TRACES_SAMPLE_RATE),",
    "  });",
    "",
    "  isSentryInitialized = true;",
    "  return true;",
    "}",
    "",
    "export function resetSentryForTests() {",
    "  isSentryInitialized = false;",
    "}",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Module: Redis
// ---------------------------------------------------------------------------

function buildRedisClient() {
  return [
    'import type { RedisClient as RateLimitRedisClient } from "@hono-rate-limiter/redis";',
    'import { z } from "zod";',
    "",
    'const DEFAULT_REDIS_URL = "redis://localhost:6379";',
    "",
    "const redisEnvironmentSchema = z.object({",
    "  REDIS_URL: z.string().trim().min(1).optional(),",
    "});",
    "",
    "type RedisRawEnv = Record<string, string | undefined>;",
    'type BunRedisClient = import("bun").RedisClient;',
    'type BunRedisConstructor = typeof import("bun").RedisClient;',
    "",
    "export interface RedisEnvironment {",
    "  url: string;",
    "}",
    "",
    "let sharedRedisClient: BunRedisClient | null = null;",
    "let sharedRedisUrl: string | null = null;",
    "",
    "export function hasBunRedisClient() {",
    "  const bun = globalThis as typeof globalThis & {",
    "    Bun?: {",
    "      RedisClient?: BunRedisConstructor;",
    "    };",
    "  };",
    "",
    '  return typeof bun.Bun?.RedisClient === "function";',
    "}",
    "",
    "function stringifyRedisArgument(value: unknown): string {",
    '  if (typeof value === "string") {',
    "    return value;",
    "  }",
    "",
    '  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {',
    "    return String(value);",
    "  }",
    "",
    '  throw new TypeError("Redis command arguments must be strings, numbers, bigints, or booleans");',
    "}",
    "",
    "export function resolveRedisEnvironment(rawEnv: RedisRawEnv = process.env): RedisEnvironment {",
    "  const parsedEnv = redisEnvironmentSchema.parse(rawEnv);",
    "",
    "  return {",
    "    url: parsedEnv.REDIS_URL ?? DEFAULT_REDIS_URL,",
    "  };",
    "}",
    "",
    "export function createRedisClient(rawEnv: RedisRawEnv = process.env): BunRedisClient {",
    "  const { url } = resolveRedisEnvironment(rawEnv);",
    "  const bun = globalThis as typeof globalThis & {",
    "    Bun?: {",
    "      RedisClient?: BunRedisConstructor;",
    "    };",
    "  };",
    "  const RedisClient = bun.Bun?.RedisClient;",
    "",
    "  if (!RedisClient) {",
    '    throw new Error("Bun RedisClient is unavailable outside the Bun runtime");',
    "  }",
    "",
    "  return new RedisClient(url);",
    "}",
    "",
    "export function getRedisClient(rawEnv: RedisRawEnv = process.env): BunRedisClient {",
    "  const { url } = resolveRedisEnvironment(rawEnv);",
    "",
    "  if (!sharedRedisClient || sharedRedisUrl !== url) {",
    "    sharedRedisClient?.close();",
    "    sharedRedisClient = createRedisClient({",
    "      REDIS_URL: url,",
    "    });",
    "    sharedRedisUrl = url;",
    "  }",
    "",
    "  return sharedRedisClient;",
    "}",
    "",
    "export function createRedisRateLimitClient(",
    "  rawEnv: RedisRawEnv = process.env",
    "): RateLimitRedisClient {",
    "  const client = getRedisClient(rawEnv);",
    "",
    "  return {",
    "    async scriptLoad(script: string) {",
    '      const result = await client.send("SCRIPT", ["LOAD", script]);',
    "",
    '      if (typeof result !== "string") {',
    '        throw new TypeError("Redis SCRIPT LOAD returned a non-string response");',
    "      }",
    "",
    "      return result;",
    "    },",
    "    async evalsha<TArgs extends unknown[], TData = unknown>(",
    "      sha1: string,",
    "      keys: string[],",
    "      args: TArgs",
    "    ) {",
    '      return client.send("EVALSHA", [',
    "        sha1,",
    "        keys.length.toString(),",
    "        ...keys,",
    "        ...args.map(stringifyRedisArgument),",
    "      ]) as Promise<TData>;",
    "    },",
    "    decr(key: string) {",
    "      return client.decr(key);",
    "    },",
    "    del(key: string) {",
    "      return client.del(key);",
    "    },",
    "  };",
    "}",
    "",
    "export function resetRedisClientForTests() {",
    "  sharedRedisClient?.close();",
    "  sharedRedisClient = null;",
    "  sharedRedisUrl = null;",
    "}",
    "",
  ].join("\n");
}

function buildRateLimitMiddleware() {
  return [
    'import { env } from "~/server/lib/env.ts";',
    'import { getRedisClient } from "~/server/lib/redis.ts";',
    "",
    "type RateLimitConfig = {",
    "  keyPrefix: string;",
    "  windowMs: number;",
    "  limit: number;",
    "  keyGenerator: (request: Request) => string;",
    "};",
    "",
    "export function getClientIp(request: Request): string {",
    '  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()',
    '    ?? request.headers.get("x-real-ip")',
    '    ?? "unknown";',
    "}",
    "",
    "export const publicRateLimitConfig: RateLimitConfig = {",
    '  keyPrefix: "public",',
    "  windowMs: env.RATE_LIMIT_WINDOW_MS,",
    "  limit: env.RATE_LIMIT_PUBLIC_LIMIT,",
    "  keyGenerator: req => getClientIp(req),",
    "};",
    "",
    "export const authenticatedRateLimitConfig: RateLimitConfig = {",
    '  keyPrefix: "authenticated",',
    "  windowMs: env.RATE_LIMIT_WINDOW_MS,",
    "  limit: env.RATE_LIMIT_AUTHENTICATED_LIMIT,",
    '  keyGenerator: req => req.headers.get("x-user-id")?.trim() || getClientIp(req),',
    "};",
    "",
    "export const webhookRateLimitConfig: RateLimitConfig = {",
    '  keyPrefix: "webhook",',
    "  windowMs: env.RATE_LIMIT_WINDOW_MS,",
    "  limit: env.RATE_LIMIT_WEBHOOK_LIMIT,",
    '  keyGenerator: req => req.headers.get("stripe-signature")?.trim() || getClientIp(req),',
    "};",
    "",
    "export async function checkRateLimit(request: Request, config: RateLimitConfig) {",
    "  const client = getRedisClient();",
    "  const key = `rate-limit:${config.keyPrefix}:${config.keyGenerator(request)}`;",
    "  const current = await client.incr(key);",
    "",
    "  if (current === 1) {",
    "    await client.pexpire(key, config.windowMs);",
    "  }",
    "",
    "  return {",
    "    isAllowed: current <= config.limit,",
    "    key,",
    "    remaining: Math.max(config.limit - current, 0),",
    "    resetAfterMs: config.windowMs,",
    "  };",
    "}",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Module: Storybook
// ---------------------------------------------------------------------------

function buildStorybookMain() {
  return [
    'import type { StorybookConfig } from "@storybook/react-vite";',
    "",
    "const config: StorybookConfig = {",
    '  stories: ["../src/**/*.stories.@(ts|tsx)"],',
    "  addons: [",
    '    "@storybook/addon-essentials",',
    '    "@storybook/addon-interactions",',
    "  ],",
    "  framework: {",
    '    name: "@storybook/react-vite",',
    "    options: {},",
    "  },",
    "};",
    "",
    "export default config;",
    "",
  ].join("\n");
}

function buildStorybookPreview() {
  return [
    'import "../src/styles.css";',
    "",
    "export const parameters = {",
    '  layout: "centered",',
    "};",
    "",
  ].join("\n");
}
