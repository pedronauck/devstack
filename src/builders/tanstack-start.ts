import { readFile } from "node:fs/promises";
import path from "node:path";
import { MODULE_REGISTRY } from "../modules/index.ts";
import {
  copyDirectoryWithTemplates as copyDirectory,
  copySelectedSubdirectories,
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
  patchPluginNames,
  resolveSkillsForModules,
  SKILLS_DIR,
  TEMPLATES_DIR,
  toJson,
} from "./shared.ts";
import type { GenerateContext } from "./types.ts";

const BASE_ROOT_DIR = path.join(TEMPLATES_DIR, "base", "root");
const BASE_FRONTEND_DIR = path.join(TEMPLATES_DIR, "base", "frontend");

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

async function copyModuleSkills(context: GenerateContext) {
  if (!(await pathExists(SKILLS_DIR))) {
    throw new Error(
      "Skills submodule not initialized. Run: git submodule update --init --recursive"
    );
  }
  const selectedSkills = resolveSkillsForModules(context.resolvedModules, context.stackModel);
  await copySelectedSubdirectories(
    SKILLS_DIR,
    path.join(context.targetDir, ".claude/skills"),
    selectedSkills,
    context.tokens
  );
}

// ---------------------------------------------------------------------------
// Shared dynamic files (root-level: package.json, turbo, docker, claude, etc.)
// ---------------------------------------------------------------------------

async function writeSharedDynamicFiles(context: GenerateContext) {
  await ensureDir(path.join(context.targetDir, ".github/workflows"));
  await ensureDir(path.join(context.targetDir, ".husky"));
  await ensureDir(path.join(context.targetDir, "docker/postgres"));
  await ensureDir(path.join(context.targetDir, ".claude"));

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
  await writeTextFile(path.join(context.targetDir, "CLAUDE.md"), buildClaudeMd(context, builder));
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
  await writeTextFile(path.join(appDir, "app.config.ts"), buildAppConfigTs());
  await writeTextFile(path.join(appDir, "tsconfig.json"), toJson(buildAppTsConfig()));
  await writeTextFile(path.join(appDir, "drizzle.config.ts"), buildDrizzleConfig());
  await writeTextFile(path.join(appDir, "vitest.config.ts"), buildVitestConfig(context));

  // Entry points
  await writeTextFile(path.join(appDir, "src/client.tsx"), buildClientEntry());
  await writeTextFile(path.join(appDir, "src/server.ts"), buildServerEntry());
  await writeTextFile(path.join(appDir, "src/router.tsx"), buildRouterEntry());
  await writeTextFile(path.join(appDir, "src/routeTree.gen.ts"), buildRouteTreeStub());

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
  await writeTextFile(path.join(serverDir, "lib/errors.ts"), buildErrors());
  await writeTextFile(path.join(serverDir, "lib/id.ts"), buildId());

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
    await writeTextFile(path.join(appDir, "server/lib/tracing.ts"), buildTracingLib());
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
      dev: "vinxi dev --port 3000",
      build: "vinxi build",
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
      "@tabler/icons-react": "^3.40.0",
      "@tanstack/react-query": "^5.90.21",
      "@tanstack/react-query-devtools": "^5.91.3",
      "@tanstack/react-router": "^1.166.7",
      "@tanstack/react-router-devtools": "^1.166.7",
      "@tanstack/react-start": "^1.166.7",
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
      "react-resizable-panels": "^4.7.2",
      recharts: "2.15.4",
      sonner: "^2.0.7",
      "tailwind-merge": "^3.5.0",
      tailwindcss: "^4.2.1",
      "tw-animate-css": "^1.4.0",
      uuid: "^13.0.0",
      vaul: "^1.1.2",
      vinxi: "^0.6.3",
      zod: "^4.3.6",
      zustand: "^5.0.11",
    },
    devDependencies: {
      "@tailwindcss/vite": "^4.2.1",
      "@testing-library/dom": "^10.4.1",
      "@testing-library/react": "^16.3.2",
      "@vitejs/plugin-react": "^6.0.0",
      "drizzle-kit": "^0.31.9",
      dotenv: "^17.3.1",
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

function buildAppConfigTs() {
  return [
    'import { defineConfig } from "@tanstack/react-start/config";',
    'import tailwindcss from "@tailwindcss/vite";',
    'import tsConfigPaths from "vite-tsconfig-paths";',
    "",
    "export default defineConfig({",
    "  tsr: {",
    '    appDirectory: "src",',
    "  },",
    "  vite: {",
    "    plugins: () => [",
    '      tsConfigPaths({ projects: ["./tsconfig.json"] }),',
    "      tailwindcss(),",
    "    ],",
    "  },",
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
      jsx: "react-jsx",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      paths: {
        "@/*": ["./src/*"],
        "~/*": ["./*"],
      },
    },
    include: ["src", "server", "app.config.ts"],
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

function buildServerEntry() {
  return [
    'import handler, { createServerEntry } from "@tanstack/react-start/server-entry";',
    "",
    "export default createServerEntry({",
    "  fetch(request) {",
    "    return handler.fetch(request);",
    "  },",
    "});",
    "",
  ].join("\n");
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

function buildRouteTreeStub() {
  return [
    "/* prettier-ignore-start */",
    "",
    "/* eslint-disable */",
    "",
    "// @ts-nocheck",
    "",
    "// noinspection JSUnusedGlobalSymbols",
    "",
    "// This file is auto-generated by TanStack Router",
    "",
    'import { createFileRoute } from "@tanstack/react-router";',
    "",
    "// placeholder — will be overwritten on first `vinxi dev` run",
    "export const routeTree = {} as never;",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

function buildRootRoute(context: GenerateContext) {
  return replaceTemplateTokens(
    [
      'import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";',
      'import type { ReactNode } from "react";',
      'import appCss from "~/src/styles.css?url";',
      "",
      "export const Route = createRootRoute({",
      "  head: () => ({",
      "    meta: [",
      '      { charSet: "utf-8" },',
      '      { name: "viewport", content: "width=device-width, initial-scale=1" },',
      '      { title: "{{projectTitle}}" },',
      "    ],",
      "    links: [",
      '      { rel: "stylesheet", href: appCss },',
      "    ],",
      "  }),",
      "  shellComponent: RootDocument,",
      "  component: RootComponent,",
      "});",
      "",
      "function RootComponent() {",
      "  return (",
      "    <RootDocument>",
      "      <Outlet />",
      "    </RootDocument>",
      "  );",
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
    "const client = postgres(connectionString);",
    "export const db = drizzle(client, { schema });",
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
    '  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),',
    "  PORT: z.coerce.number().default(3000),",
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

function buildErrors() {
  return [
    "export class AppError extends Error {",
    "  constructor(",
    "    message: string,",
    "    public readonly statusCode: number = 500,",
    "    public readonly code?: string,",
    "  ) {",
    "    super(message);",
    '    this.name = "AppError";',
    "  }",
    "}",
    "",
    "export class NotFoundError extends AppError {",
    '  constructor(message = "Not found") {',
    '    super(message, 404, "NOT_FOUND");',
    "  }",
    "}",
    "",
    "export class ValidationError extends AppError {",
    '  constructor(message = "Validation failed") {',
    '    super(message, 400, "VALIDATION_ERROR");',
    "  }",
    "}",
    "",
    "export class UnauthorizedError extends AppError {",
    '  constructor(message = "Unauthorized") {',
    '    super(message, 401, "UNAUTHORIZED");',
    "  }",
    "}",
    "",
  ].join("\n");
}

function buildId() {
  return [
    'import { v7 as uuidv7 } from "uuid";',
    "",
    "export function generateId(): string {",
    "  return uuidv7();",
    "}",
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
  return replaceTemplateTokens(
    [
      'import { createFileRoute } from "@tanstack/react-router";',
      "",
      'export const Route = createFileRoute("/api/health")({',
      "  handler: async () => {",
      "    return Response.json({",
      '      status: "ok",',
      "      timestamp: new Date().toISOString(),",
      "    });",
      "  },",
      "});",
      "",
    ].join("\n"),
    context.tokens
  );
}

function buildEnvExample(context: GenerateContext) {
  const lines = [
    "# Database",
    `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${context.projectName}`,
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
    lines.push("# Inngest", "INNGEST_EVENT_KEY=", "INNGEST_SIGNING_KEY=", "");
  }
  if (context.resolvedModules.includes("observability")) {
    lines.push("# Observability", "SENTRY_DSN=", "");
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

function buildTracingLib() {
  return [
    "// OpenTelemetry tracing setup",
    "// Initialize in server.ts or app.config.ts",
    "",
    "export function initializeTracing() {",
    "  // Add OpenTelemetry SDK initialization here",
    "}",
    "",
    "export function shutdownTracing() {",
    "  // Add graceful shutdown here",
    "}",
    "",
  ].join("\n");
}

function buildSentryLib() {
  return [
    "// Sentry error tracking setup",
    "",
    "export function initializeSentry() {",
    "  const dsn = process.env.SENTRY_DSN;",
    "  if (!dsn) return;",
    "",
    "  // Add Sentry initialization here",
    "  // import * as Sentry from '@sentry/node';",
    "  // Sentry.init({ dsn });",
    "}",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Module: Redis
// ---------------------------------------------------------------------------

function buildRedisClient() {
  return [
    "export function getRedisClient() {",
    '  const url = process.env.REDIS_URL ?? "redis://localhost:6379";',
    "  // Use your preferred Redis client here",
    "  // import { createClient } from 'redis';",
    "  // return createClient({ url });",
    "  return { url };",
    "}",
    "",
  ].join("\n");
}

function buildRateLimitMiddleware() {
  return [
    "type RateLimitConfig = {",
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
    '  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? "60000"),',
    '  limit: Number(process.env.RATE_LIMIT_PUBLIC_LIMIT ?? "30"),',
    "  keyGenerator: (req) => getClientIp(req),",
    "};",
    "",
    "// Implement rate limiting using Redis INCR + PEXPIRE",
    "export async function checkRateLimit(_request: Request, _config: RateLimitConfig): Promise<void> {",
    "  // const client = getRedisClient();",
    "  // const key = `rate-limit:${config.keyGenerator(request)}`;",
    "  // const current = await client.incr(key);",
    "  // if (current === 1) await client.pexpire(key, config.windowMs);",
    "  // if (current > config.limit) throw new Error('Too many requests');",
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
