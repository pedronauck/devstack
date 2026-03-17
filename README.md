# devstack

CLI scaffold generator that creates production-ready full-stack monorepo projects with Bun, Turborepo, React 19, Hono, Drizzle ORM, and PostgreSQL.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## About

Devstack generates complete monorepo projects with everything wired together — frontend, backend, database, Docker infrastructure, CI/CD, linting, testing, and AI agent configuration. Instead of spending days assembling a stack, run one command and start building your product.

Every generated project ships with an **AI agent intelligence layer** — pre-configured `CLAUDE.md` and skill files that give Claude Code (and other AI agents) deep context about your project's architecture, conventions, and tooling.

## Features

- **Two stack models** — choose between a separated API + SPA architecture or a fullstack SSR setup
- **Modular architecture** — pick only what you need from 9 optional modules (auth, payments, email, storage, etc.)
- **Production-ready defaults** — Oxlint, Oxfmt, Vitest, Husky, Conventional Commits, GitHub Actions CI
- **Docker Compose infrastructure** — PostgreSQL, Redis, MinIO, Inngest, Mailpit — all pre-configured
- **AI-native projects** — generated `CLAUDE.md` with skill dispatch protocol, architecture docs, and agent skill files
- **Template overlays** — modules contribute files, env vars, Docker services, and dependencies that merge cleanly into the base project

## Stack Models

### Separated (Hono API + Vite React)

Two packages with a clear boundary between frontend and backend:

```
packages/
├── frontend/   # React 19 + Vite + TanStack Router + Tailwind v4
└── backend/    # Hono + Drizzle ORM + PostgreSQL + Zod OpenAPI
```

**Frontend**: React 19, Vite 8, TanStack Router (file-based), TanStack Query, Zustand, shadcn/ui (50+ components), Tailwind v4 with oklch color tokens, dark mode.

**Backend**: Hono v4 with Zod OpenAPI, Scalar API docs, Drizzle ORM, LogTape logging, Prometheus metrics, structured error handling. Follows a route → usecase → repository layered architecture.

### TanStack Start (Fullstack SSR)

Single package with server functions and SSR:

```
packages/
└── app/        # TanStack Start + Server Functions + SSR
    ├── src/routes/    # File-based routes (UI + API)
    └── server/        # Server-only code (db, lib)
```

Same UI layer (shadcn/ui, Tailwind v4, TanStack Query) with server functions replacing the separate API.

## Modules

All modules are optional. Select any combination during scaffolding:

| Module             | What it adds                                          |
| ------------------ | ----------------------------------------------------- |
| **Authentication** | Better Auth with email/password sessions              |
| **Organizations**  | Multi-tenant org membership and roles (requires Auth) |
| **Stripe**         | Plans, subscriptions, and webhook handling            |
| **Storage**        | S3/MinIO object storage with presigned URLs           |
| **Email**          | Resend + SMTP fallback + React Email templates        |
| **Inngest**        | Background jobs with local dev server                 |
| **Observability**  | OpenTelemetry tracing + Sentry error tracking         |
| **Redis**          | Redis client + rate limiting middleware               |
| **Storybook**      | Component documentation workspace + Chromatic         |

Modules declare dependencies — selecting **Organizations** automatically includes **Authentication**. Each module contributes:

- Environment variables (`.env.example` + Zod-validated `env.ts`)
- Docker Compose services
- Package dependencies (merged into the correct `package.json`)
- Template files (overlaid onto the base project)
- CLAUDE.md sections and agent skill files

## Requirements

- [Bun](https://bun.sh) >= 1.2.0
- [Docker](https://docs.docker.com/get-docker/) (for infrastructure services)
- Git

## Quick Start

```bash
# Run the CLI
bunx devstack

# Follow the prompts:
#   1. App name (e.g., my-saas)
#   2. Target directory
#   3. Stack model (Separated or TanStack Start)
#   4. Optional modules
#   5. Install dependencies (yes/no)
#   6. Initialize git (yes/no)

# Start your project
cd my-saas
docker compose up -d
bun run dev
```

## Generated Project Structure

A project generated with the **Separated** stack and **Auth + Stripe** modules:

```
my-saas/
├── packages/
│   ├── frontend/              # React 19 SPA
│   │   ├── src/
│   │   │   ├── components/    # shadcn/ui + app components
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   ├── lib/           # Utilities, API client
│   │   │   ├── routes/        # TanStack Router (file-based)
│   │   │   └── stores/        # Zustand stores
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── backend/               # Hono API
│       ├── src/
│       │   ├── modules/       # Feature modules (items, auth, billing)
│       │   ├── plugins/       # Hono middleware (error, logging, metrics)
│       │   ├── db/            # Drizzle schema + migrations
│       │   ├── lib/           # Auth client, Stripe client
│       │   └── env.ts         # Zod-validated environment
│       ├── package.json
│       └── drizzle.config.ts
├── .claude/
│   ├── settings.json          # Allowed/denied commands for Claude Code
│   └── skills/                # Agent skill files
├── .github/
│   └── workflows/ci.yaml      # PR validation + make check
├── lint-plugins/               # Custom Oxlint rules
├── docker-compose.yaml         # PostgreSQL + module services
├── turbo.json                  # Turborepo task graph
├── Makefile                    # check, test, lint, fmt, db-reset
├── CLAUDE.md                   # AI agent instructions
└── AGENTS.md                   # Same as CLAUDE.md (for Codex)
```

## Generated Tooling

Every generated project includes:

| Tool                    | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| **Bun**                 | Package manager and runtime                |
| **Turborepo**           | Monorepo task orchestration                |
| **Oxlint**              | Fast linting (zero warnings policy)        |
| **Oxfmt**               | Fast formatting                            |
| **Vitest**              | Unit and integration testing               |
| **Husky + lint-staged** | Pre-commit hooks                           |
| **Commitlint**          | Conventional Commits enforcement           |
| **GitHub Actions**      | CI pipeline (PR title + `make check`)      |
| **Docker Compose**      | PostgreSQL, Redis, MinIO, Inngest, Mailpit |

## AI Agent Intelligence Layer

Generated projects are designed to work well with AI coding agents. The scaffolder produces:

1. **CLAUDE.md / AGENTS.md** — comprehensive instruction files containing architecture overview, coding conventions, skill enforcement rules, and a dispatch protocol table that maps domain keywords to required agent skills.

2. **Skill files** (`.claude/skills/` and `.agents/skills/`) — domain-specific knowledge files (React, Hono, Drizzle, Stripe, etc.) that give agents deep understanding of the libraries your project uses.

3. **Settings** (`.claude/settings.json`) — pre-approved safe commands (`bun *`, `docker compose *`, `make *`) and blocked destructive git commands.

The skill set is stack-aware: the **Separated** stack includes the `hono` skill while **TanStack Start** includes `tanstack-start-best-practices`. Module-specific skills are added based on your selections (e.g., `better-auth-best-practices`, `stripe-webhooks`).

## Development (Contributing to Devstack)

### Setup

```bash
git clone https://github.com/compozy/devstack.git
cd devstack
git submodule update --init --recursive   # Initialize skills submodule
bun install
```

### Commands

```bash
bun run dev              # Run the CLI interactively
bun run test             # Run tests (Vitest)
bun run typecheck        # Type-check with tsc
bun run lint             # Format check (Oxfmt) + lint (Oxlint)
bun run format           # Format all files
make check               # format + lint-fix + typecheck + test (full pipeline)
```

### Project Structure

```
src/
├── cli.ts               # Interactive prompts (@clack/prompts)
├── generator.ts         # Core scaffolding engine
├── index.ts             # Entry point
├── builders/
│   ├── shared.ts        # Shared builders (Docker Compose, CLAUDE.md, Makefile)
│   ├── tanstack-start.ts # TanStack Start generation
│   └── types.ts         # GenerateContext type
├── modules/
│   ├── types.ts         # ModuleDefinition, MODULE_ORDER, skill types
│   ├── index.ts         # MODULE_REGISTRY
│   └── *.ts             # One file per module (auth, stripe, storage, etc.)
└── utils/
    ├── files.ts         # File copy, template processing, oxfmt formatting
    ├── packages.ts      # package.json deep merge
    └── template.ts      # Token replacement ({{projectName}}, etc.)

templates/
├── base/                # Base project files (root, frontend, backend)
└── modules/             # Per-module template overlays

tests/                   # Vitest test suite
vendor/skills/           # Git submodule — agent skill source files
```

### How It Works

1. The CLI collects user choices (name, stack model, modules)
2. The resolver auto-includes transitive module dependencies
3. Base templates are copied to the target directory
4. Module template overlays are merged on top
5. Template tokens (`{{projectName}}`, `{{projectTitle}}`, etc.) are replaced in all text files
6. Dynamic files are generated (package.json, docker-compose.yaml, CLAUDE.md, env.ts, turbo.json)
7. Module package contributions are deep-merged into the correct package.json files
8. Agent skill files are copied based on stack model + selected modules
9. All generated files are formatted with Oxfmt
10. Optionally: `bun install` and `git init` with initial commit

### Running Tests

```bash
bun run test                    # All tests
bun run test:coverage           # With coverage report
bunx vitest run tests/modules   # Specific test file
```

Tests include unit tests for utilities and integration tests that scaffold real projects in temp directories and verify file contents.

### Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new module
fix: correct template token replacement
refactor: extract shared builder functions
test: add integration tests for TanStack Start
```

## License

devstack is licensed under the MIT license. See the [`LICENSE`](LICENSE) file for details.
