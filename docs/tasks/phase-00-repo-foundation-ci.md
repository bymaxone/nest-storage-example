# Phase 0: repo-foundation-ci

> **Status**: 🔄 In Progress · **Progress**: 3 / 6 tasks · **Last updated**: 2026-07-07
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P0)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §5, §6, §22

## Context

The repository contains only `docs/` on an otherwise empty `main`. This phase produces a buildable
pnpm workspace with the full Bymax toolchain and, critically, **CI from day one**: the phase's own
PR is already gated by the `ci` workflow it introduces. CodeQL and OpenSSF Scorecard workflows are
created now but run conditionally, staying inert while the repository is private and activating
automatically when it goes public.

## Rules-of-phase

1. No application code in this phase: tooling, governance, and CI only.
2. Every config is real and verified (no copied-but-unused settings).
3. The workspace anticipates `apps/api` and `apps/web` but creates no empty directories.
4. Conventional Commits enforced locally (husky + commitlint) before CI ever sees a commit.
5. Public-only CI features must skip cleanly while private: `if: ${{ !github.event.repository.private }}`.

## Reference docs

- `../TECHNICAL_SPECIFICATION.md` §5 (Tech Stack), §6 (Repository Layout), §22 (Tooling, CI & Conventions)
- `../DEVELOPMENT_PLAN.md` §4 (Global Conventions), Appendix B (Quality Gates)

## Task index

| ID  | Task                                                               | Status  | Priority | Size | Depends on |
| --- | ------------------------------------------------------------------ | ------- | -------- | ---- | ---------- |
| 0.1 | Branch + workspace root (pnpm, engines, scripts, tsconfig base)    | ✅ Done | P0       | S    | none       |
| 0.2 | Lint & format toolchain (ESLint 9 flat + Prettier 3)               | ✅ Done | P0       | S    | 0.1        |
| 0.3 | Git governance (husky, commitlint, lint-staged, .gitmessage)       | ✅ Done | P0       | S    | 0.1        |
| 0.4 | Community & meta files (LICENSE, README stub, CHANGELOG, Renovate) | 📋 ToDo | P1       | S    | 0.1        |
| 0.5 | CI workflows: `ci.yml` + conditional `codeql.yml`/`scorecard.yml`  | 📋 ToDo | P0       | M    | 0.2        |
| 0.6 | Phase close: audit, dashboards, PR + Copilot review, merge         | 📋 ToDo | P0       | S    | 0.1-0.5    |

## Tasks

### Task 0.1: Branch + workspace root

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: none

#### Description

Create the phase branch and the pnpm workspace skeleton: root `package.json`,
`pnpm-workspace.yaml`, Node pinning, and the strict shared TypeScript base.

#### Acceptance criteria

- [x] Branch `feat/phase-00-repo-foundation-ci` created with `git switch -c`.
- [x] Root `package.json`: `private: true`, `packageManager` pnpm pin, `engines.node >=24`, workspaces via `pnpm-workspace.yaml` (`apps/*`), scripts `lint`, `typecheck`, `format`, `format:check`, `test`, `test:e2e`, `infra:up|down|nuke|logs` (infra scripts may point at the compose file arriving in P1; they must fail gracefully until then).
- [x] `.nvmrc` = `24`; `.npmrc` with `engine-strict=true` and `frozen-lockfile=true`; `.gitignore`; `.editorconfig`.
- [x] `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, ES2022, NodeNext.
- [x] `pnpm install` exits 0 on a clean clone.

#### Files to create / modify

- `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.npmrc`, `.gitignore`, `.editorconfig`, `tsconfig.base.json`

#### Agent prompt

```
You are a senior TypeScript platform engineer scaffolding a pnpm workspace.

PROJECT: nest-storage-example, the reference application for @bymax-one/nest-storage
(provider-agnostic S3 object storage for NestJS 11). Stack: pnpm workspaces, Node >= 24,
TypeScript 5.9 strict. Repo: github.com/bymaxone/nest-storage-example (private today, public later).

CURRENT PHASE: 0 (repo-foundation-ci), Task 0.1 of 6 (FIRST).

PRECONDITIONS
- The repo contains only docs/ on main; no application code exists.
- You are on main with a clean tree.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §5 (Tech Stack), §6 (Repository Layout)
- docs/DEVELOPMENT_PLAN.md §4 (Global Conventions)

TASK
Create the phase branch and the workspace root: package.json, pnpm-workspace.yaml, Node pinning,
strict shared tsconfig, and repo hygiene files.

DELIVERABLES
1. Create the branch FIRST: `git switch -c feat/phase-00-repo-foundation-ci` (NEVER `git checkout -b`).
2. `package.json`: private, name `nest-storage-example`, packageManager pnpm (current stable pin),
   engines.node `>=24`, scripts: lint, typecheck (workspace fan-out `pnpm -r --workspace-concurrency=1 exec tsc --noEmit`
   once packages exist; a safe no-op fan-out now), format, format:check, test, test:e2e,
   infra:up (`docker compose up -d --wait`), infra:down, infra:nuke (`down -v`), infra:logs.
3. `pnpm-workspace.yaml` with `packages: ['apps/*']`.
4. `.nvmrc` (24), `.npmrc` (`engine-strict=true`, `frozen-lockfile=true`), `.gitignore`
   (node_modules, dist, .next, coverage, .stryker-tmp, reports, .env), `.editorconfig`.
5. `tsconfig.base.json`: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes,
   verbatimModuleSyntax, target ES2022, module NodeNext.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- TS strict, no any, no suppression comments. English-only. Timeless comments (no phase/task refs in files).
- No .gitkeep, no empty directories, no placeholder apps.
- Conventional Commit: `chore(repo): scaffold pnpm workspace root (0.1)`.

Verification:
- `pnpm install` exits 0.
- `node -p "require('./package.json').engines.node"` prints `>=24`.
- `git branch --show-current` prints `feat/phase-00-repo-foundation-ci`.

Completion Protocol:
1. Set this task's Status to ✅ in its block and in the Task index.
2. Tick all acceptance criteria checkboxes.
3. Increment the header Progress counter (n/6).
4. Update the P0 row in docs/DEVELOPMENT_PLAN.md §1 (progress + last updated) and mirror in docs/tasks/README.md.
5. Append to the Completion log: `- 0.1 ✅ YYYY-MM-DD: <one-line summary>`.
6. Commit with the Conventional message above.
```

---

### Task 0.2: Lint & format toolchain

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 0.1

#### Description

ESLint 9 flat config (type-checked, scoped) and Prettier 3, wired to the root scripts.

#### Acceptance criteria

- [x] `eslint.config.mjs`: flat, `recommendedTypeChecked` scoped to `**/*.ts`/`**/*.tsx`, test-file relaxations, ignores (`dist`, `.next`, `coverage`, `.stryker-tmp`).
- [x] Banned-import rules active: `axios`, `bcrypt`, `jsonwebtoken`, `moment`, `lodash`, `uuid`, `dotenv` (Node natives or the platform provide these).
- [x] `.prettierrc.mjs` (`printWidth: 100`, `singleQuote`, `semi: false`, `trailingComma: 'all'`) + `.prettierignore`.
- [x] `pnpm lint` and `pnpm format:check` exit 0.

#### Files to create / modify

- `eslint.config.mjs`, `.prettierrc.mjs`, `.prettierignore`, `package.json` (devDependencies)

#### Agent prompt

```
You are a senior TypeScript tooling engineer.

PROJECT: nest-storage-example (reference app for @bymax-one/nest-storage). pnpm workspace,
TypeScript 5.9 strict, Node >= 24.

CURRENT PHASE: 0, Task 0.2 of 6 (MIDDLE).

PRECONDITIONS
- Task 0.1 done: workspace root exists on branch feat/phase-00-repo-foundation-ci.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §4 (Global Conventions)
- eslint.org flat-config docs and typescript-eslint docs for current API (verify, never from memory)

TASK
Add ESLint 9 flat config with type-checked rules and banned imports, plus Prettier 3, both wired
to root scripts and passing on the current tree.

DELIVERABLES
1. `eslint.config.mjs`: typescript-eslint recommendedTypeChecked scoped to TS/TSX with
   `parserOptions.projectService`; ignores for dist/.next/coverage/.stryker-tmp/node_modules;
   `no-restricted-imports` banning axios, bcrypt, jsonwebtoken, moment, lodash, uuid, dotenv
   (message pointing to the native alternative); relaxed unsafe-* rules for `**/*.spec.ts`.
2. `.prettierrc.mjs` (printWidth 100, singleQuote true, semi false, trailingComma all) and
   `.prettierignore` (pnpm-lock.yaml, dist, .next, coverage).
3. devDependencies pinned; `pnpm lint` / `pnpm format` / `pnpm format:check` scripts functional.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Verify current ESLint/typescript-eslint APIs against their official docs before writing config.
- English-only, timeless comments, no suppressions.
- Conventional Commit: `chore(lint): add eslint flat config and prettier (0.2)`.

Verification:
- `pnpm lint` exits 0.
- `pnpm format:check` exits 0.
- `echo "import axios from 'axios'" > /tmp/probe.ts` then linting a workspace file importing axios fails (spot-check the rule locally, do not commit the probe).

Completion Protocol:
1. Set this task's Status to ✅ in its block and in the Task index.
2. Tick all acceptance criteria checkboxes.
3. Increment the header Progress counter (n/6).
4. Update the P0 row in docs/DEVELOPMENT_PLAN.md §1 and mirror in docs/tasks/README.md.
5. Append to the Completion log: `- 0.2 ✅ YYYY-MM-DD: <summary>`.
6. Commit with the Conventional message above.
```

---

### Task 0.3: Git governance

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 0.1

#### Description

Husky hooks, commitlint (Conventional Commits), lint-staged, and the commit template.

#### Acceptance criteria

- [x] `.husky/pre-commit` runs `pnpm exec lint-staged`; `.husky/commit-msg` runs commitlint.
- [x] `commitlint.config.mjs` extends `@commitlint/config-conventional`.
- [x] `lint-staged.config.mjs`: eslint --fix + prettier --write on staged TS/TSX/MD/JSON.
- [x] `.gitmessage` with the project scopes (repo, infra, api, web, vault, uploads, signed, validation, scanner, tenants, errors, system, ci, docs, test).
- [x] A non-Conventional commit message is rejected locally.

#### Files to create / modify

- `.husky/pre-commit`, `.husky/commit-msg`, `commitlint.config.mjs`, `lint-staged.config.mjs`, `.gitmessage`, `package.json` (`prepare` script)

#### Agent prompt

```
You are a senior developer-experience engineer.

PROJECT: nest-storage-example. pnpm workspace on Node >= 24.

CURRENT PHASE: 0, Task 0.3 of 6 (MIDDLE).

PRECONDITIONS
- Tasks 0.1-0.2 done on branch feat/phase-00-repo-foundation-ci (ESLint + Prettier exist).

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §4 (Global Conventions)
- husky and commitlint current official docs (verify the current husky init shape, never from memory)

TASK
Enforce Conventional Commits and staged-file quality locally: husky + commitlint + lint-staged +
.gitmessage.

DELIVERABLES
1. `package.json` prepare script (`husky`), devDependencies for husky/commitlint/lint-staged.
2. `.husky/pre-commit` (pnpm exec lint-staged) and `.husky/commit-msg` (pnpm exec commitlint --edit "$1").
3. `commitlint.config.mjs` extending config-conventional.
4. `lint-staged.config.mjs`: `*.{ts,tsx}` -> eslint --fix + prettier --write; `*.{md,json,yml,yaml,mjs}` -> prettier --write.
5. `.gitmessage` template listing the commit types and this repo's scopes; `git config commit.template .gitmessage` documented in the file header comment.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- English-only, timeless comments.
- Conventional Commit: `chore(repo): add husky, commitlint and lint-staged governance (0.3)`.

Verification:
- `echo "bad message" | pnpm exec commitlint` exits non-zero.
- `pnpm exec lint-staged --help` exits 0.
- A real commit with the Conventional message succeeds (hooks fire).

Completion Protocol:
1. Set this task's Status to ✅ in its block and in the Task index.
2. Tick all acceptance criteria checkboxes.
3. Increment the header Progress counter (n/6).
4. Update the P0 row in docs/DEVELOPMENT_PLAN.md §1 and mirror in docs/tasks/README.md.
5. Append to the Completion log: `- 0.3 ✅ YYYY-MM-DD: <summary>`.
6. Commit with the Conventional message above.
```

---

### Task 0.4: Community & meta files

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: S
- **Depends on**: 0.1

#### Description

Public-grade repository meta: MIT license, README stub linking the docs, CHANGELOG, Renovate.

#### Acceptance criteria

- [ ] `LICENSE` (MIT, © Bymax One).
- [ ] `README.md` stub: one-paragraph purpose, links to the three docs, quick-start placeholder, "status: under construction" note that reads professionally.
- [ ] `CHANGELOG.md` (Keep a Changelog header, Unreleased section).
- [ ] `renovate.json`: extends `config:recommended`, groups `@bymax-one/*` (pinned while `file:`-linked), weekend schedule, groups GitHub Actions and Docker digests.

#### Files to create / modify

- `LICENSE`, `README.md`, `CHANGELOG.md`, `renovate.json`

#### Agent prompt

```
You are a senior open-source maintainer preparing a repository for public release.

PROJECT: nest-storage-example (reference app for @bymax-one/nest-storage). The repo is private
today and will become public; every word must already be public-grade.

CURRENT PHASE: 0, Task 0.4 of 6 (MIDDLE).

PRECONDITIONS
- Tasks 0.1-0.3 done on branch feat/phase-00-repo-foundation-ci.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §1 (Purpose) and §24 (Phased Delivery Plan) for the README stub wording
- The sibling nest-cache-example README header style (github.com/bymaxone/nest-cache-example) as the house style

TASK
Add LICENSE, README stub, CHANGELOG, and Renovate configuration.

DELIVERABLES
1. `LICENSE`: MIT, copyright Bymax One.
2. `README.md`: project title, one-paragraph mission (the canonical reference app exercising every
   public feature of @bymax-one/nest-storage), a docs table linking TECHNICAL_SPECIFICATION.md,
   DEVELOPMENT_PLAN.md and tasks/, and a Quick Start placeholder pointing at `pnpm infra:up && pnpm dev`.
3. `CHANGELOG.md` in Keep a Changelog format with an Unreleased section.
4. `renovate.json`: config:recommended, a packageRule grouping `@bymax-one/**`, actions and docker
   groups, weekend schedule.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Public-grade wording; no internal project references; no em dashes anywhere.
- Conventional Commit: `docs(repo): add license, readme stub, changelog and renovate (0.4)`.

Verification:
- `head -3 LICENSE` shows the MIT header.
- README links resolve to existing files (relative paths).
- `pnpm exec prettier --check README.md CHANGELOG.md renovate.json` exits 0.

Completion Protocol:
1. Set this task's Status to ✅ in its block and in the Task index.
2. Tick all acceptance criteria checkboxes.
3. Increment the header Progress counter (n/6).
4. Update the P0 row in docs/DEVELOPMENT_PLAN.md §1 and mirror in docs/tasks/README.md.
5. Append to the Completion log: `- 0.4 ✅ YYYY-MM-DD: <summary>`.
6. Commit with the Conventional message above.
```

---

### Task 0.5: CI workflows (day one, public-conditional extras)

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 0.2

#### Description

The `ci.yml` gating every PR from this phase forward, plus `codeql.yml` and `scorecard.yml` that
skip cleanly while the repository is private and activate on the public flip.

#### Acceptance criteria

- [ ] `.github/workflows/ci.yml`: on `pull_request` + `push` to `main`; jobs `lint`, `typecheck`, `format` (sequential steps or needs-chained jobs); pnpm caching via `pnpm/action-setup` **before** `actions/setup-node` with `cache: pnpm`; actions SHA-pinned; least-privilege `permissions`.
- [ ] Later-phase jobs (`test:cov`, `e2e`, `web-build`, `mutation`, `export-usage`) are NOT stubbed as green no-ops; they simply do not exist yet (added by their phases).
- [ ] `.github/workflows/codeql.yml` and `scorecard.yml` exist with `if: ${{ !github.event.repository.private }}` on their jobs.
- [ ] `.github/dependabot.yml` or the Renovate config covers actions updates (no duplication: pick Renovate, document the choice inline).
- [ ] CI is green on this phase's PR.

#### Files to create / modify

- `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.github/workflows/scorecard.yml`

#### Agent prompt

```
You are a senior CI engineer.

PROJECT: nest-storage-example. pnpm workspace, Node >= 24. Repo private today, public later:
public-only security workflows must be created NOW but gated on visibility.

CURRENT PHASE: 0, Task 0.5 of 6 (MIDDLE).

PRECONDITIONS
- Tasks 0.1-0.4 done on branch feat/phase-00-repo-foundation-ci; lint/typecheck/format scripts pass locally.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md Appendix B (Quality Gates) and §4 item 9
- GitHub Actions official docs for pnpm setup ordering and workflow permissions (verify current action versions and pin SHAs)

TASK
Create the day-one CI plus the conditional CodeQL and Scorecard workflows.

DELIVERABLES
1. `.github/workflows/ci.yml`: triggers pull_request + push(main); a single job or needs-chain
   running install (frozen lockfile), lint, typecheck, format:check; pnpm/action-setup BEFORE
   setup-node with cache: pnpm; `permissions: contents: read`; all third-party actions pinned by
   commit SHA with a version comment.
2. `.github/workflows/codeql.yml`: CodeQL default setup for javascript-typescript, schedule +
   pull_request, every job guarded with `if: ${{ !github.event.repository.private }}`.
3. `.github/workflows/scorecard.yml`: OpenSSF Scorecard action, same visibility guard,
   `id-token: write` only where the action requires it.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Do not fabricate green placeholder jobs for future phases; jobs join when their phase lands.
- Job names are contractual once branch protection references them; choose stable names (lint, typecheck, format).
- Conventional Commit: `ci(repo): add day-one ci with conditional codeql and scorecard (0.5)`.

Verification:
- `pnpm exec prettier --check .github/workflows/*.yml` exits 0.
- `grep -c 'github.event.repository.private' .github/workflows/codeql.yml .github/workflows/scorecard.yml` returns at least 1 each.
- After push, `gh run list --branch feat/phase-00-repo-foundation-ci` shows ci green (verify before phase close).

Completion Protocol:
1. Set this task's Status to ✅ in its block and in the Task index.
2. Tick all acceptance criteria checkboxes.
3. Increment the header Progress counter (n/6).
4. Update the P0 row in docs/DEVELOPMENT_PLAN.md §1 and mirror in docs/tasks/README.md.
5. Append to the Completion log: `- 0.5 ✅ YYYY-MM-DD: <summary>`.
6. Commit with the Conventional message above.
```

---

### Task 0.6: Phase close

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 0.1-0.5

#### Description

Audit the phase's Definition of Done, sync every dashboard, open the PR with a GitHub Copilot
review, address findings, and merge with CI green.

#### Acceptance criteria

- [ ] Every P0 acceptance criterion and the plan's P0 Definition of Done verified on a clean clone.
- [ ] Phase file header ✅, task index all ✅, completion log full; plan §1 row + counters updated; tasks/README.md mirror updated.
- [ ] PR opened via `gh pr create` with a professional English title/body; **GitHub Copilot code review requested**; every finding addressed or answered.
- [ ] Merged via `gh pr merge --squash --delete-branch` with CI green; local branch pruned.

#### Files to create / modify

- `docs/tasks/phase-00-repo-foundation-ci.md`, `docs/DEVELOPMENT_PLAN.md`, `docs/tasks/README.md`

#### Agent prompt

```
You are a senior release engineer closing a development phase.

PROJECT: nest-storage-example. Repo: github.com/bymaxone/nest-storage-example.

CURRENT PHASE: 0, Task 0.6 of 6 (LAST: phase close).

PRECONDITIONS
- Tasks 0.1-0.5 are ✅ on branch feat/phase-00-repo-foundation-ci; CI green on the branch.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §5 (P0 Definition of Done) and §6 (Update Protocol)
- docs/tasks/README.md (Branch & PR workflow)

TASK
Audit, update dashboards, open the phase PR with a Copilot review, address findings, merge clean.

DELIVERABLES
1. Re-run the full local gate from a clean state: `pnpm install && pnpm lint && pnpm typecheck && pnpm format:check`.
2. Update: this phase file header (Status ✅ when merged, Progress 6/6), Task index, Completion log;
   docs/DEVELOPMENT_PLAN.md §1 (P0 row + global counters + active phase -> P1); docs/tasks/README.md mirror.
3. `gh pr create --title "feat(repo): phase 0, repository foundation and day-one CI" --body <professional summary listing deliverables and verification>`.
4. Request the GitHub Copilot code review on the PR (via the GitHub UI reviewers panel or
   `gh pr edit --add-reviewer copilot-pull-request-reviewer[bot]`; if the reviewer slug is
   unavailable, request via the UI). Wait for the review, address EVERY finding (fix or reasoned
   reply), re-request when substantive changes land.
5. Merge only when CI is green and the review is resolved: `gh pr merge --squash --delete-branch`.
   Then `git switch main && git pull` and confirm a clean tree.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with a failing check; never bypass with --no-verify or admin merge.

Verification:
- `gh pr view --json state,mergedAt` shows MERGED.
- `git ls-remote --heads origin feat/phase-00-repo-foundation-ci` prints nothing.
- docs/DEVELOPMENT_PLAN.md §1 shows P0 ✅ 6/6.

Completion Protocol:
1. Set this task's Status to ✅ in its block and in the Task index.
2. Tick all acceptance criteria checkboxes.
3. Set the phase header to ✅ with Progress 6/6.
4. Update docs/DEVELOPMENT_PLAN.md §1 and docs/tasks/README.md.
5. Append to the Completion log: `- 0.6 ✅ YYYY-MM-DD: phase merged in PR #<n>`.
6. Commit the dashboard updates on main as `docs(plan): mark P0 complete`.
```

## Completion log

<!-- append lines: - N.M ✅ YYYY-MM-DD: summary -->

- 0.3 ✅ 2026-07-07: added husky v9 hooks (pre-commit/commit-msg), commitlint with config-conventional, lint-staged with eslint+prettier on staged files, and .gitmessage template
- 0.2 ✅ 2026-07-07: added ESLint 9 flat config with recommendedTypeChecked, banned imports, test relaxations, Prettier 3 with project settings, and .prettierignore
- 0.1 ✅ 2026-07-07: scaffolded pnpm workspace root with package.json, pnpm-workspace.yaml, .nvmrc, .npmrc, .gitignore, .editorconfig, and tsconfig.base.json
