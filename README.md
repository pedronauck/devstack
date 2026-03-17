<div align="center">

# ⚡ devstack

**Ship your full-stack app in minutes, not days.**

CLI scaffold generator that creates production-ready monorepo projects with\
Bun, Turborepo, React 19, Hono, Drizzle ORM, and PostgreSQL.

[![npm version](https://img.shields.io/npm/v/devstack?style=flat-square&color=cb3837&logo=npm)](https://www.npmjs.com/package/devstack)
[![npm downloads](https://img.shields.io/npm/dm/devstack?style=flat-square&color=cb3837&logo=npm)](https://www.npmjs.com/package/devstack)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-%E2%89%A51.2-f9f1e1?style=flat-square&logo=bun&logoColor=14151a)](https://bun.sh)
[![GitHub stars](https://img.shields.io/github/stars/pedronauck/devstack?style=flat-square&logo=github)](https://github.com/pedronauck/devstack/stargazers)

<br />

```bash
bunx devstack
```

<br />

[Getting Started](#-getting-started) · [Stack Models](#-stack-models) · [Modules](#-modules) · [AI Layer](#-ai-agent-intelligence-layer) · [Contributing](#-contributing)

</div>

---

## 🧐 Why devstack?

Every new project starts the same way — days wiring up linters, formatters, auth, payments, Docker, CI, database migrations… **devstack eliminates that entirely.** Run one command, pick your stack and modules, and get a production-grade monorepo with everything already connected.

Every generated project also ships with an **AI agent intelligence layer** — pre-configured `CLAUDE.md` and skill files that give Claude Code (and other AI agents) deep context about your project's architecture, conventions, and tooling.

## ✨ Features

- 🏗️ **Two stack models** — separated API + SPA or fullstack SSR
- 🧩 **9 optional modules** — auth, payments, email, storage, background jobs, and more
- 🔧 **Production-ready defaults** — Oxlint, Oxfmt, Vitest, Husky, Conventional Commits, GitHub Actions
- 🐳 **Docker Compose infra** — PostgreSQL, Redis, MinIO, Inngest, Mailpit — all pre-configured
- 🤖 **AI-native projects** — `CLAUDE.md` with skill dispatch protocol, architecture docs, agent skills
- 📦 **Template overlays** — modules contribute files, env vars, Docker services, and deps that merge cleanly

## 🚀 Getting Started

### Prerequisites

| Requirement                                   | Version  |
| --------------------------------------------- | -------- |
| [Bun](https://bun.sh)                         | >= 1.2.0 |
| [Docker](https://docs.docker.com/get-docker/) | Latest   |
| Git                                           | Any      |

### Usage

```bash
# Run the interactive CLI
bunx devstack

# Follow the prompts:
#   1. App name (e.g., my-saas)
#   2. Target directory
#   3. Stack model (Separated or TanStack Start)
#   4. Optional modules
#   5. Install dependencies (yes/no)
#   6. Initialize git (yes/no)

# Start building
cd my-saas
docker compose up -d
bun run dev
```

## 🏗️ Stack Models

Choose the architecture that fits your project:

### Separated (Hono API + Vite React)

Two packages with a clear boundary between frontend and backend:

```
packages/
├── frontend/   # React 19 + Vite + TanStack Router + Tailwind v4
└── backend/    # Hono + Drizzle ORM + PostgreSQL + Zod OpenAPI
```

<details>
<summary><strong>Frontend details</strong></summary>

React 19, Vite 8, TanStack Router (file-based), TanStack Query, Zustand, shadcn/ui (50+ components), Tailwind v4 with oklch color tokens, dark mode.

</details>

<details>
<summary><strong>Backend details</strong></summary>

Hono v4 with Zod OpenAPI, Scalar API docs, Drizzle ORM, LogTape logging, Prometheus metrics, structured error handling. Follows a **route → usecase → repository** layered architecture.

</details>

### TanStack Start (Fullstack SSR)

Single package with server functions and SSR:

```
packages/
└── app/
    ├── src/routes/    # File-based routes (UI + API)
    └── server/        # Server-only code (db, lib)
```

Same UI layer (shadcn/ui, Tailwind v4, TanStack Query) with server functions replacing the separate API.

## 🧩 Modules

All modules are optional — pick any combination during scaffolding:

| Module                | What it adds                                            |
| --------------------- | ------------------------------------------------------- |
| 🔐 **Authentication** | Better Auth with email/password sessions                |
| 🏢 **Organizations**  | Multi-tenant org membership and roles _(requires Auth)_ |
| 💳 **Stripe**         | Plans, subscriptions, and webhook handling              |
| 📁 **Storage**        | S3/MinIO object storage with presigned URLs             |
| 📧 **Email**          | Resend + SMTP fallback + React Email templates          |
| ⚙️ **Inngest**        | Background jobs with local dev server                   |
| 📡 **Observability**  | OpenTelemetry tracing + Sentry error tracking           |
| 🔴 **Redis**          | Redis client + rate limiting middleware                 |
| 📖 **Storybook**      | Component documentation workspace + Chromatic           |

<details>
<summary><strong>How modules work</strong></summary>

Modules declare dependencies — selecting **Organizations** automatically includes **Authentication**. Each module contributes:

- Environment variables (`.env.example` + Zod-validated `env.ts`)
- Docker Compose services
- Package dependencies (merged into the correct `package.json`)
- Template files (overlaid onto the base project)
- CLAUDE.md sections and agent skill files

</details>

## 📂 Generated Project Structure

> A project generated with the **Separated** stack and **Auth + Stripe** modules:

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
│   │   └── vite.config.ts
│   └── backend/               # Hono API
│       ├── src/
│       │   ├── modules/       # Feature modules (items, auth, billing)
│       │   ├── plugins/       # Hono middleware (error, logging, metrics)
│       │   ├── db/            # Drizzle schema + migrations
│       │   ├── lib/           # Auth client, Stripe client
│       │   └── env.ts         # Zod-validated environment
│       └── drizzle.config.ts
├── .claude/
│   ├── settings.json          # Allowed/denied commands for Claude Code
│   └── skills/                # Agent skill files
├── .github/
│   └── workflows/ci.yaml      # PR validation + make check
├── docker-compose.yaml         # PostgreSQL + module services
├── turbo.json                  # Turborepo task graph
├── Makefile                    # check, test, lint, fmt, db-reset
├── CLAUDE.md                   # AI agent instructions
└── AGENTS.md                   # Same as CLAUDE.md (for Codex)
```

## 🔧 Generated Tooling

Every generated project includes a battle-tested toolchain:

| Tool                                                     | Purpose                                    |
| -------------------------------------------------------- | ------------------------------------------ |
| [Bun](https://bun.sh)                                    | Package manager and runtime                |
| [Turborepo](https://turbo.build)                         | Monorepo task orchestration                |
| [Oxlint](https://oxc.rs)                                 | Fast linting (zero warnings policy)        |
| [Oxfmt](https://oxc.rs)                                  | Fast formatting                            |
| [Vitest](https://vitest.dev)                             | Unit and integration testing               |
| [Husky](https://typicode.github.io/husky/) + lint-staged | Pre-commit hooks                           |
| [Commitlint](https://commitlint.js.org/)                 | Conventional Commits enforcement           |
| [GitHub Actions](https://github.com/features/actions)    | CI pipeline (PR title + `make check`)      |
| [Docker Compose](https://docs.docker.com/compose/)       | PostgreSQL, Redis, MinIO, Inngest, Mailpit |

## 🤖 AI Agent Intelligence Layer

Generated projects are designed to work seamlessly with AI coding agents:

| Layer                                  | What it provides                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| **CLAUDE.md / AGENTS.md**              | Architecture overview, coding conventions, skill enforcement rules, and dispatch protocol |
| **Skill files** (`.claude/skills/`)    | Domain-specific knowledge (React, Hono, Drizzle, Stripe, etc.)                            |
| **Settings** (`.claude/settings.json`) | Pre-approved safe commands and blocked destructive operations                             |

> [!TIP]
> The skill set is **stack-aware**: the Separated stack includes the `hono` skill while TanStack Start includes `tanstack-start-best-practices`. Module-specific skills are added based on your selections (e.g., `better-auth-best-practices`, `stripe-webhooks`).

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Setup

```bash
git clone https://github.com/pedronauck/devstack.git
cd devstack
git submodule update --init --recursive
bun install
```

### Commands

```bash
bun run dev              # Run the CLI interactively
bun run test             # Run tests (Vitest)
bun run typecheck        # Type-check with tsc
bun run lint             # Format check (Oxfmt) + lint (Oxlint)
bun run format           # Format all files
make check               # Full pipeline: format + lint-fix + typecheck + test
```

<details>
<summary><strong>Project structure</strong></summary>

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

</details>

<details>
<summary><strong>How it works</strong></summary>

1. The CLI collects user choices (name, stack model, modules)
2. The resolver auto-includes transitive module dependencies
3. Base templates are copied to the target directory
4. Module template overlays are merged on top
5. Template tokens (`{{projectName}}`, etc.) are replaced in all text files
6. Dynamic files are generated (package.json, docker-compose.yaml, CLAUDE.md, env.ts, turbo.json)
7. Module package contributions are deep-merged into the correct package.json files
8. Agent skill files are copied based on stack model + selected modules
9. All generated files are formatted with Oxfmt
10. Optionally: `bun install` and `git init` with initial commit

</details>

### Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new module
fix: correct template token replacement
refactor: extract shared builder functions
test: add integration tests for TanStack Start
```

## 📄 License

MIT © [Pedro Nauck](https://github.com/pedronauck)

---

<div align="center">

**Built with ❤️ by [Pedro Nauck](https://github.com/pedronauck)**

⭐ If devstack saves you time, consider giving it a star!

</div>
