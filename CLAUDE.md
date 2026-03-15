# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## HIGH PRIORITY

- **IF YOU DON'T CHECK SKILLS** your task will be invalidated and we will generate rework
- **YOU CAN ONLY** finish a task if `make check` passes at 100% (runs `fmt + lint-fix + typecheck + test`). No exceptions — failing any of these commands means the task is **NOT COMPLETE**
- **`bun run lint` treats warnings as errors**. **Zero warnings allowed** — any oxlint warning is a blocking failure, not something to ignore
- **ALWAYS** check dependent file APIs before writing tests to avoid writing wrong code
- **NEVER** use workarounds, especially in tests — always use the `no-workarounds` skill for any fix/debug task + `test-antipatterns` for tests
- **ALWAYS** use the `no-workarounds` and `systematic-debugging` skills when fixing bugs or complex issues
- **YOU MUST** use Context7 or Exa (`exa-web-search-free` skill via mcporter) when researching external libraries/frameworks before implementing integrations — always do **3-7 searches** with Exa for better results
- **NEVER** use Context7 or Exa to search local project code — for local code, use Grep/Glob instead
- **YOU SHOULD NEVER** install dependencies by hand in `package.json` without verifying the package exists and checking its latest version — always use `bun add` instead

## MANDATORY REQUIREMENTS

- **MUST** run `make check` (or equivalently `bun run format && bun run lint && bun run typecheck && bun run test`) before completing ANY subtask. All commands must exit with **zero errors and zero warnings**. If any command fails, fix the issues and re-run until all pass
- **ALWAYS USE** the `typescript-advanced` skill before working with complex TypeScript patterns
- **ALWAYS USE** the `vitest` skill before writing or modifying tests
- **ALWAYS USE** the `zod` skill when working with validation schemas
- **Skipping any verification check will result in IMMEDIATE TASK REJECTION**

## Skills Enforcement

When working on this project, **always use the relevant skills** for the technology being touched:

### Generator & CLI

- **TypeScript patterns**: Use `typescript-advanced` skill
- **Validation (Zod schemas)**: Use `zod` skill
- **Utility functions (es-toolkit)**: Use `es-toolkit` skill
- **Testing (Vitest)**: Use `vitest` skill

### Template Content (what gets generated)

When editing templates that will be part of generated projects, use the domain-specific skill:

- **React/Frontend templates**: Use `react` skill
- **Hono/Backend templates**: Use `hono` skill
- **Database templates (Drizzle)**: Use `postgres-drizzle` + `drizzle-orm` skills
- **Auth templates (Better Auth)**: Use `better-auth-best-practices` skill
- **Organization templates**: Use `organization-best-practices` skill
- **Stripe templates**: Use `stripe-integration` + `stripe-best-practices` skills
- **Stripe subscription templates**: Use `stripe-subscriptions` skill
- **Stripe webhook templates**: Use `stripe-webhooks` skill
- **Inngest templates**: Use `inngest` skill
- **Storybook templates**: Use `storybook` skill
- **UI components (shadcn/ui)**: Use `shadcn` skill
- **TanStack Router**: Use `tanstack-router-best-practices` skill
- **TanStack Query**: Use `tanstack-query-best-practices` skill
- **Zustand**: Use `zustand` skill

### Process & Quality

- **Before any creative/feature work**: Use `brainstorming` skill
- **Executing implementation plans**: Use `executing-plans` skill
- **Debugging/fixing bugs**: Use `no-workarounds` + `systematic-debugging` skills (enforce root-cause fixes)
- **Writing/changing tests**: Use `test-antipatterns` skill (prevents mock-testing-mocks and production pollution)
- **Before claiming task is complete**: Use `verification-before-completion` skill
- **Code review (cross-model)**: Use `adversarial-review` skill
- **Architectural analysis/dead code**: Use `architectural-analysis` skill
- **PR review fixes**: Use `fix-coderabbit-review` skill
- **Git rebase/conflicts**: Use `git-rebase` skill
- **Prompt generation for LLMs**: Use `to-prompt` skill
- **Code analysis (Pal MCP)**: Use `pal` skill
- **Discover/install skills**: Use `find-skills` skill
- **Creating skills**: Use `skills-best-practices` skill

## Commands

```bash
# Setup (after cloning)
git submodule update --init --recursive  # Initialize skills submodule

# Development
bun run dev              # Run CLI in development mode

# Quality
bun run lint             # Format (oxfmt) + lint (oxlint)
bun run typecheck        # Type check with tsc
bun run format           # Format with oxfmt
bun run format:check     # Check formatting
bun run test             # Run tests (Vitest)

# Makefile shortcuts
make check               # Run format + lint-fix + typecheck + test
make commit              # Run check pipeline + git add + opencommit
make clean               # Remove node_modules, build artifacts, caches
make update              # Interactive dependency update (taze)
```

## CRITICAL: Git Commands Restriction

- **ABSOLUTELY FORBIDDEN**: **NEVER** run `git restore`, `git checkout`, `git reset`, `git clean`, `git rm`, or any other git commands that modify or discard working directory changes **WITHOUT EXPLICIT USER PERMISSION**
- **DATA LOSS RISK**: These commands can **PERMANENTLY LOSE CODE CHANGES** and cannot be easily recovered
- **REQUIRED ACTION**: If you need to revert or discard changes, **YOU MUST ASK THE USER FIRST** and wait for explicit permission before executing any destructive git command
- **VIOLATION CONSEQUENCE**: Running destructive git commands without explicit permission will result in **IMMEDIATE TASK REJECTION** and potential **IRREVERSIBLE DATA LOSS**

## Code Search and Discovery

- **TOOL HIERARCHY**: Use tools in this order:
  1. **Grep** / **Glob** — preferred for local project code (exact string matching, file patterns)
  2. **Context7** — for external libraries and frameworks documentation (structured docs)
  3. **Exa** (`exa-web-search-free` skill via mcporter) — for web research, latest news, code examples, and up-to-date information
- **WHEN TO USE Context7**: Only when you need to understand an external library's API or patterns and Grep/Glob cannot help
- **WHEN TO USE Exa**: For broader web research, latest library versions, blog posts, tutorials, best practices. **Always perform 3-7 searches** with different queries for comprehensive results
- **FORBIDDEN**: Never use Context7 or Exa for local project code — they cannot understand your local codebase

## Architecture

**@compozy/devstack** is a CLI scaffold generator that creates full-stack monorepo projects with Bun, Turborepo, React 19, Hono, Drizzle ORM, and PostgreSQL.

### Project Structure

```
src/
├── cli.ts               # Interactive CLI prompts (@clack/prompts)
├── generator.ts         # Core scaffolding engine (file copy, template processing, merging)
├── index.ts             # Entry point
├── modules/             # Module definitions (auth, stripe, storage, etc.)
│   ├── types.ts         # ModuleDefinition, ModuleName, MODULE_ORDER
│   ├── index.ts         # MODULE_REGISTRY and resolution
│   ├── auth.ts          # Better Auth module
│   ├── organizations.ts # Multi-tenant organizations module
│   ├── stripe.ts        # Stripe payments module
│   ├── storage.ts       # S3/MinIO storage module
│   ├── email.ts         # Email (Resend/SMTP) module
│   ├── inngest.ts       # Background jobs module
│   ├── observability.ts # OpenTelemetry/Sentry module
│   ├── redis.ts         # Redis module
│   └── storybook.ts     # Storybook module
└── utils/
    ├── files.ts         # File system operations (copy, template processing)
    ├── packages.ts      # package.json merging logic
    └── template.ts      # Template token replacement ({{projectName}}, etc.)

templates/
├── base/
│   ├── root/            # Monorepo root (turbo.json, docker-compose, Makefile, CLAUDE.md)
│   ├── frontend/        # React 19 + Vite + TanStack Router + Tailwind v4
│   └── backend/         # Hono + Drizzle + PostgreSQL + Zod OpenAPI
└── modules/
    └── <module>/        # Module-specific template overlays

vendor/
└── skills/              # Git submodule (github.com/pedronauck/skills) — source of truth for all agent skills

tests/
├── template.test.ts     # Template token replacement tests
├── packages.test.ts     # Package.json merging tests
├── modules.test.ts      # Module resolution tests
└── files.test.ts        # File utility tests
```

### Key Concepts

- **Modules**: Optional feature packages (auth, stripe, inngest, etc.) that contribute env vars, Docker services, package dependencies, template overlays, and CLAUDE.md sections
- **Module Resolution**: Modules can declare `requires` dependencies; the resolver auto-includes transitive dependencies
- **Template Tokens**: Placeholders like `{{projectName}}` and `{{projectTitle}}` are replaced during scaffolding — these are ONLY used inside `templates/`, never in generated app code
- **Template Overlays**: Module-specific files are merged on top of base templates
- **Package Merging**: Module `PackageContributions` are deep-merged into root/frontend/backend `package.json` files

### Generated Project Stack

The CLI generates projects with:

- **Frontend**: React 19 + Vite + TanStack Router + TanStack Query + Tailwind v4
- **Backend**: Hono + Drizzle ORM + PostgreSQL + Zod OpenAPI helpers
- **Tooling**: Bun, Turborepo, Oxlint, Oxfmt, Vitest, Husky, lint-staged, Conventional Commits
- **Infrastructure**: Docker Compose (PostgreSQL, optional Redis/MinIO/Inngest)

### Tooling

- **Package manager**: Bun
- **Linting**: Oxlint
- **Formatting**: Oxfmt
- **Type checking**: tsc (TypeScript)
- **Testing**: Vitest
- **Commits**: Conventional Commits + commitlint + husky + lint-staged

## Coding Style & Naming Conventions

- **TypeScript**: 2-space indent; semicolons; double quotes. Lint with Oxlint, format with Oxfmt
- File names: kebab-case for all `.ts` files
- Exports: prefer named exports
- Module definitions follow the `ModuleDefinition` interface in `src/modules/types.ts`

## Commit & Pull Request Guidelines

- Use Conventional Commits: `feat: ...`, `fix: ...`, `refactor: ...`, `test: ...`, `docs: ...`, `chore: ...`, `build: ...`
- Before opening a PR: run `make check`
- Do not rewrite unrelated files or reformat the whole repo — limit diffs to your change

## Security & Configuration

- Environment files: keep secrets in `.env` (never commit). Mirror keys in `.env.example`
- Do not introduce unnecessary dependencies — audit every new package addition

## Agent Skill Dispatch Protocol

Every agent MUST follow this protocol before writing code:

### Step 1: Identify Task Domain

Scan the task description and target files to determine which domains are involved:

- **Generator/CLI** keywords: cli, prompt, scaffolding, generate, module, template, overlay
- **Module definition** keywords: module, ModuleDefinition, requires, envVars, dockerServices, PackageContributions
- **Template content** keywords: template, base/frontend, base/backend, base/root, template overlay
- **Utility** keywords: file copy, merge, package.json, template tokens
- **Testing** keywords: test, spec, mock, stub, fixture, assertion, coverage, vitest
- **Debugging** keywords: bug, fix, error, failure, crash, unexpected, broken, regression
- **TypeScript advanced** keywords: generics, conditional types, mapped types, template literals, utility types

### Step 2: Activate All Matching Skills

Use the `Skill` tool to activate every skill that matches the identified domains:

| Domain                   | Required Skills                                 | Conditional Skills                                           |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------ |
| Generator/CLI code       | `typescript-advanced`                           | + `zod` (validation)                                         |
| Template: Backend/Hono   | `hono` + `postgres-drizzle` + `drizzle-orm`     | + `drizzle-safe-migrations` (migrations)                     |
| Template: Auth           | `better-auth-best-practices`                    | + `organization-best-practices` (orgs)                       |
| Template: Payments       | `stripe-integration` + `stripe-best-practices`  | + `stripe-subscriptions` + `stripe-webhooks`                 |
| Template: Frontend/React | `react`                                         | + `shadcn` (UI) + `tanstack-router-best-practices` (routing) |
| Template: Data fetching  | `tanstack-query-best-practices` + `react`       | + `zustand` (state)                                          |
| Utility functions        | `es-toolkit`                                    |                                                              |
| Bug fix                  | `systematic-debugging` + `no-workarounds`       | + `test-antipatterns` (test failures)                        |
| Writing tests            | `vitest` + `test-antipatterns`                  | + domain skill for code being tested                         |
| Task completion          | `verification-before-completion`                |                                                              |
| External lib research    | Context7 + `exa-web-search-free` (3-7 searches) |                                                              |
| Architecture audit       | `architectural-analysis`                        |                                                              |
| Creative/new features    | `brainstorming`                                 | + domain-specific skills                                     |
| Plan execution           | `executing-plans`                               |                                                              |
| Creating skills          | `skills-best-practices`                         |                                                              |

### Step 3: Verify Before Completion

Before any agent marks a task as complete:

1. Activate `verification-before-completion` skill
2. Run `make check` (or `bun run format && bun run lint && bun run typecheck && bun run test`)
3. Read and verify the full output — no skipping
4. Only then claim completion

## Anti-Patterns for Agents

**NEVER do these:**

1. **Skip skill activation** because "it's a small change" — every domain change requires its skill
2. **Activate only one skill** when the code touches multiple domains
3. **Forget `verification-before-completion`** before marking tasks done
4. **Write tests without `test-antipatterns`** — leads to mock-testing-mocks and production code pollution
5. **Fix bugs without `systematic-debugging`** — leads to symptom-patching instead of root cause fixes
6. **Apply workarounds without `no-workarounds`** — type assertions, lint suppressions, error swallowing are all rejected without root-cause justification
7. **Claim task is done when any check has warnings or errors** — zero warnings, zero errors, zero test failures. No exceptions
8. **Install dependencies by hand** — always verify the package exists and check its latest version; use `bun add`
9. **Use Context7 or Exa for local code** — they are only for external library documentation and web research
10. **Do only 1 Exa search** — always perform **3-7 searches** with varied queries for comprehensive results
11. **Run destructive git commands without permission** — `git restore`, `git reset`, `git clean`, etc. require explicit user approval
12. **Edit generated template output** instead of the template source — always edit files in `templates/` or `vendor/skills/`, never directly in generated project output
