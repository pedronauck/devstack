Goal (incl. success criteria):

- Add a script that audits dependency versions used by scaffold package manifests, run it, and update every outdated dependency it reports.
- Success means: the script can inspect the real package-manifest sources for generated projects/templates, outdated packages are updated to current npm `latest`, and the repo passes validation after the updates.

Constraints/Assumptions:

- Do not use destructive git commands (`git restore`, `git checkout`, `git reset`, `git clean`, `git rm`) without explicit permission.
- Do not touch unrelated dirty worktree changes beyond the required continuity ledger update and files directly needed for this fix.
- Tests must protect correctness; if tests expose bugs, fix production code instead of weakening tests.
- External package/version facts must be verified against current registry/docs, not memory.

Key decisions:

- Audit scope should include the real dependency sources for generated package manifests: `src/generator.ts`, `src/builders/tanstack-start.ts`, `src/modules/*.ts`, and physical `templates/**/package.json` files.
- Prefer a single Bun/TypeScript script with read-only and `--write` modes so the same logic both reports and updates versions.
- Preserve range prefixes like `^` and `~` when updating to the latest stable version.

State:

- Dependency audit and update completed; validation passed.

Done:

- Read the existing continuity ledger and relevant workspace instructions.
- Confirmed that physical `templates/**/package.json` files are only a small subset of scaffold manifests; most generated package manifests are composed from TypeScript source files.
- Mapped likely dependency-source files with `rg`, including `src/generator.ts`, `src/builders/tanstack-start.ts`, and `src/modules/*.ts`.
- Added a reusable dependency audit utility and a Bun CLI script to scan scaffold dependency declarations against npm `latest`.
- Added npm scripts for audit/update and unit coverage for the helper logic.
- Ran the auditor in read-only mode and found 42 outdated dependency declarations.
- Applied the updates with the new script, including generated scaffold sources and template example package manifests.
- Re-ran the auditor and confirmed `Outdated: 0`.
- Ran `make check` successfully after the version updates.

Now:

- Final response preparation.

Next:

- None.

Open questions (UNCONFIRMED if needed):

- None currently blocking.

Working set (files/ids/commands):

- `.codex/CONTINUITY.md`
- `src/generator.ts`
- `src/builders/tanstack-start.ts`
- `src/modules/*.ts`
- `templates/**/package.json`
- `bin/audit-template-deps.ts`
- `src/utils/template-dependency-audit.ts`
- `tests/template-dependency-audit.test.ts`
- `rg -n 'dependencies:|devDependencies:|peerDependencies:' src/generator.ts src/builders/tanstack-start.ts src/modules/*.ts -S`
- `rg --files -g 'package.json' templates src tests . | sort`
- `bun run deps:templates:audit`
- `bun run deps:templates:update`
- `make check`
