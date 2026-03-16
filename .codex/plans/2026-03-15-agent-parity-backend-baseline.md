# Align Generator With Dash Agent Support And Backend Baseline

## Summary

Use a parity-first approach: mirror the Claude guidance surface for other agent-driven IDEs, and unify both generated backend stacks around the same shared infrastructure baseline from dash without pulling in dash’s domain-specific app code.

Chosen defaults:

- `AGENTS.md` mirrors `CLAUDE.md`.
- `.agents/skills` mirrors the same selected skill set as `.claude/skills`.
- The default backend scaffold includes shared infra only.
- Observability and Redis remain module-gated, but when enabled they generate real implementations.

## Implementation Changes

- Add agent-surface generation for both stack models so every generated project includes root `AGENTS.md` plus `.agents/skills` alongside the existing `CLAUDE.md` and `.claude/skills`.
- Refactor the guidance-file builder so `CLAUDE.md` and `AGENTS.md` are produced from the same source of truth and stay aligned unless an explicit IDE-specific divergence is introduced later.
- Refactor skill copying so the generator resolves the selected skill set once and copies it to both `.claude/skills` and `.agents/skills`.
- Normalize the backend foundation across stacks around the reusable dash-style shared layer:
  - Logging with LogTape and request-scoped context.
  - App errors plus RFC7807-style problem details formatting.
  - Shared `id`, `lazy`, `response`, and `pagination` helpers.
  - A real health/readiness baseline with database readiness by default.
  - Backend test utilities for request testing and database-backed integration tests.
- Keep framework-specific adapters separate:
  - Separated/Hono stack continues to expose middleware-based request ID, logging, metrics, and OpenAPI integration.
  - TanStack Start stack gets the same shared libs under `server/lib`, plus a thin TanStack-specific request wrapper in `src/server.ts` for request ID propagation and request completion/error logging instead of copying Hono middleware patterns directly.
- Replace the current TanStack Start placeholder implementations for observability and Redis with real dash-derived implementations when those modules are selected.
- Add a compact generated `test-utils` baseline for both backend shapes.

## Public Interfaces And Generated Output

- New root files/directories: `AGENTS.md` and `.agents/skills/*`.
- Separated backend keeps its current `src/lib` and plugin-oriented shape, but gains a test-utils baseline and any missing shared helpers needed for parity.
- TanStack Start app gains a fuller `packages/app/server/lib` shared layer and a non-placeholder infra surface for optional observability/Redis modules.
- Generated env examples and dependency manifests expand only where required by the shared infra or selected modules.
- No dash-specific business libraries are scaffolded by default unless already implied by selected modules.

## Test Plan

- Add generator coverage for both stack models asserting:
  - `AGENTS.md` is generated.
  - `AGENTS.md` content matches `CLAUDE.md`.
  - `.agents/skills` exists and mirrors the selected `.claude/skills` set.
- Add generation assertions for backend parity:
  - Separated stack emits the expected shared infra files and test-utils.
  - TanStack Start emits the expanded shared server libs and no longer emits observability/Redis placeholders when those modules are enabled.
- Add focused unit tests for any new shared builder helpers that decide which docs, skills, backend libs, env vars, and dependencies each stack receives.
- Run full validation with `make check`.

## Assumptions And Defaults

- `AGENTS.md` intentionally mirrors `CLAUDE.md` exactly.
- `.agents/skills` receives the same curated, module-aware skill subset as `.claude/skills`.
- “Shared infra only” means reusable platform helpers, not dash business/domain code.
- Observability and Redis remain optional module concerns, but their generated code must be production-grade whenever those modules are selected.
