Goal (incl. success criteria):

- Fix the TanStack Start scaffold so newly generated projects pass formatting and typecheck without manual cleanup.
- Add repository-side validation that catches scaffold regressions before release.
- Success means: generated TanStack app no longer emits the observed `.ts` import, router generation, CSS asset typing, health-route typing, hydration/root-document, or formatting failures; repo tests cover these regressions; and a heavier scaffold smoke validator exists for local/CI use.

Constraints/Assumptions:

- Do not use destructive git commands (`git restore`, `git checkout`, `git reset`, `git clean`, `git rm`) without explicit permission.
- Do not touch unrelated dirty worktree changes beyond files directly needed for this fix and the required continuity artifacts.
- Tests must protect correctness; if tests expose bugs, fix production code instead of weakening tests.
- Root-cause fixes only: no lint/type suppressions, no build-before-typecheck workaround, no manual post-generation cleanup expectation.
- Accepted Plan Mode plan must be persisted under `.codex/plans/`.

Key decisions:

- Keep the generated code style that uses `.ts` import extensions and fix the generated `tsconfig` to support it.
- Generate a valid initial `packages/app/src/routeTree.gen.ts` directly from the scaffold and let TanStack Start update it later during `dev`/`build` if routes change.
- Add fast scaffold regression coverage to the normal test suite and keep a heavier generate-install-format-typecheck smoke validator as a dedicated script for CI/manual use.
- Fix formatting at the generation source rather than expecting downstream `oxfmt --write` to normalize output.

State:

- Implemented and verified.

Done:

- Re-read workspace instructions and relevant skills (`systematic-debugging`, `no-workarounds`, `vitest`, `testing-anti-patterns`).
- Reproduced the user-reported TanStack scaffold failure from this repository by generating a fresh temp project and running install/typecheck.
- Confirmed the generated TanStack app currently fails before any user edits.
- Isolated root causes:
  - generated `packages/app/tsconfig.json` is missing `allowImportingTsExtensions`.
  - generated `packages/app/tsconfig.json` is missing Vite client types needed for `styles.css?url`.
  - generated TanStack app has no explicit route tree generation step before `typecheck`.
  - generated health route uses a too-narrow inferred type for mutable readiness checks.
  - multiple generated/copied files fail `oxfmt --check`.
- Confirmed that once `routeTree.gen.ts` is generated, the `createRouter`/`createFileRoute` type errors disappear.
- Persisted implementation plan is required next.
- Replaced the broken `tsr generate`-based approach with scaffold-time `routeTree.gen.ts` generation, including optional API routes for auth/stripe/inngest.
- Removed the generated app's dependency on `@tanstack/router-cli` and the `routes:generate` script; app `build`/`typecheck` now use the normal TanStack Start/Vite flow with a committed route tree.
- Tightened generator formatting behavior so formatter failures surface as real errors instead of silently falling back to unformatted output.
- Fixed the separated email module template to use a `.tsx` file for JSX-based email rendering so generator-side formatting remains strict without false parse failures.
- Added a generated-project TanStack smoke validator and wired it into CI.
- `bunx vitest run tests/generator.test.ts`, `bun run validate:scaffold:tanstack`, and `make check` all passed.
- Fixed the TanStack root route scaffold so `shellComponent: RootDocument` is not nested inside `component: RootComponent`, eliminating duplicate `<html>/<body>` markup during hydration.
- Added an inline favicon to the generated TanStack root route so fresh projects do not 404 on `/favicon.ico`.

Now:

- Task is complete; ready to report outcome and changed files.

Next:

- None.

Open questions (UNCONFIRMED if needed):

- None currently blocking.

Working set (files/ids/commands):

- `.codex/CONTINUITY.md`
- `.codex/plans/2026-03-16-fix-tanstack-scaffold-validation.md`
- `src/builders/tanstack-start.ts`
- `src/utils/files.ts`
- `tests/generator.test.ts`
- `tests/builders.test.ts`
- `package.json`
- `.github/workflows/ci.yaml`
- `bin/validate-tanstack-scaffold.ts`
- `templates/modules/email/packages/backend/src/lib/emails/send.tsx`
- `/tmp/devstack-plan-P3jUz7` reproduction
- `bunx vitest run tests/generator.test.ts`
- `bun run validate:scaffold:tanstack`
- `make check`
