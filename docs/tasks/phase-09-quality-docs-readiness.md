# Phase 9: quality-docs-readiness

> **Status**: 🔄 In Progress · **Progress**: 1 / 6 tasks · **Last updated**: 2026-07-07
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P9)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §21, §22, Appendix B of the plan

## Context

The app is feature-complete (P0-P8, every phase shipped with its own tests green). This closing
phase raises the repo to the full library-grade bar the sibling reference apps hold: 100% unit
coverage on all four metrics for both apps, e2e of every HTTP route and error path, Stryker
mutation testing, the export-usage audit proving every library export is demonstrated, the
polished public README, and the go-public checklist (visibility flip activates the conditional
CodeQL/Scorecard workflows).

## Rules-of-phase

1. No shortcuts to green: no `istanbul ignore`, no suppressions, no threshold lowering, no
   exclusions hiding real gaps; provably-dead branches are removed from source instead.
2. Mutation is the LAST test layer (after coverage + e2e are green); survivors are killed with
   behavioral assertions or documented as proven equivalents.
3. Suites run sequentially with bounded workers; one Testcontainers MinIO at a time.
4. The export audit is the coverage-matrix enforcement: a library export with no demonstration
   fails CI unless ignored with a written reason.

## Reference docs

- `../TECHNICAL_SPECIFICATION.md` §21 (Testing Strategy), §22 (CI)
- `../DEVELOPMENT_PLAN.md` Appendix B (Quality Gates)

## Task index

| ID  | Task                                                       | Status  | Priority | Size | Depends on |
| --- | ---------------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 9.1 | Branch + api unit suite to 100/100/100/100                 | ✅ Done | P0       | L    | none       |
| 9.2 | Web unit suite to 100/100/100/100                          | 📋 ToDo | P0       | L    | 9.1        |
| 9.3 | e2e: every route, every error path, Playwright smoke       | 📋 ToDo | P0       | L    | 9.1        |
| 9.4 | Stryker mutation (api break 100, web break 90) + docs      | 📋 ToDo | P0       | L    | 9.2, 9.3   |
| 9.5 | Export audit + README + go-public checklist                | 📋 ToDo | P0       | M    | 9.4        |
| 9.6 | Phase close: audit, dashboards, PR + Copilot review, merge | 📋 ToDo | P0       | S    | 9.1-9.5    |

## Tasks

### Task 9.1: API unit suite to 100%

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: L
- **Depends on**: none

#### Description

Close every unit-coverage gap in `apps/api` to 100% on statements, branches, functions and lines,
with the decorator-metadata phantom-branch trap handled structurally.

#### Acceptance criteria

- [x] Branch `feat/phase-09-quality-docs-readiness` created with `git switch -c`.
- [x] `apps/api/tsconfig.spec.json` compiles the unit project with `emitDecoratorMetadata: false`; the e2e project keeps metadata on.
- [x] `pnpm --filter api test:cov` reports 100/100/100/100 with zero `.skip`/`.todo` and zero ignore comments; `collectCoverageFrom` exclusions limited to `*.module.ts`, `main.ts`, `*.d.ts` (documented).
- [x] Provably-dead defensive branches removed from source, each removal a reviewed commit.

#### Files to create / modify

- `apps/api/tsconfig.spec.json`, `jest.config.ts` refinements, new/extended `*.spec.ts` across `src/`

#### Agent prompt

```
You are a senior test engineer driving a NestJS codebase to true 100% unit coverage.

PROJECT: nest-storage-example. Every service, controller, pipe, filter, store, validator, scanner,
config builder and Zod schema in apps/api must be unit-proven; DI-heavy classes are constructed
directly with mocked library providers via their @Inject Symbol tokens.

CURRENT PHASE: 9 (quality-docs-readiness), Task 9.1 of 6 (FIRST).

PRECONDITIONS
- Phases 0-8 merged; per-phase tests exist and are green; coverage threshold already at 100 but
  scoped collectCoverageFrom may have gaps to close.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §21
- apps/api/jest.config.ts and the current coverage report (run it first; the uncovered list IS the work order)

TASK
Create the branch, fix the unit toolchain (metadata-off spec tsconfig), and close every coverage
gap without shortcuts.

DELIVERABLES
1. `git switch -c feat/phase-09-quality-docs-readiness` (NEVER `git checkout -b`).
2. `tsconfig.spec.json` (emitDecoratorMetadata false) + ts-jest wired to it;
   `ignoreCoverageForAllDecorators: true` if the ts-jest option is required (verify current docs).
3. Run coverage, enumerate gaps, write the missing specs: every it() carries a scenario comment;
   mock the library via BYMAX_STORAGE_* tokens; no real network in unit tier.
4. Remove provably-dead branches from source rather than excluding them (separate commits).

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- No istanbul-ignore, no suppressions, no threshold games. Sequential runs, maxWorkers '50%'.
- Conventional Commits per logical chunk: `test(api): <area> unit coverage (9.1)`.

Verification:
- `pnpm --filter api test:cov` prints 100 on all four metrics.
- `grep -rn "istanbul ignore\|@ts-ignore\|eslint-disable" apps/api/src` returns nothing.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/6).
2. Update the P9 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 9.1 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 9.2: Web unit suite to 100%

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 9.1

#### Description

Vitest + coverage-v8 across `lib/`, `hooks/`, and `components/` to 100/100/100/100, with vendored
shadcn `components/ui/**` and route shells excluded by documented convention.

#### Acceptance criteria

- [ ] `vitest.config.ts`: coverage thresholds 100 on all four metrics; documented excludes limited to `components/ui/**` (vendored) and `app/**` route shells; jsdom + testing-library setup.
- [ ] All boundaries mocked (fetch, XHR, TanStack Query, nuqs, next/navigation); timers controlled.
- [ ] `pnpm --filter web test:cov` reports 100/100/100/100 with zero skips/ignores.

#### Files to create / modify

- `apps/web/vitest.config.ts`, `test/setup.ts`, new/extended tests across `lib/`, `hooks/`, `components/`

#### Agent prompt

```
You are a senior frontend test engineer driving a Next.js dashboard to 100% unit coverage.

PROJECT: nest-storage-example. lib/** (client, direct-upload, status), hooks/**, and
components/** (excluding vendored components/ui/** and app/** route shells) reach 100 on all four
metrics under Vitest + coverage-v8.

CURRENT PHASE: 9, Task 9.2 of 6 (MIDDLE).

PRECONDITIONS
- Task 9.1 done; existing web tests green.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §21
- apps/web/vitest.config.ts + the current coverage report (the gap list is the work order)

TASK
Harden the Vitest toolchain and close every gap without shortcuts.

DELIVERABLES
1. vitest.config.ts: @vitest/coverage-v8, thresholds 100/100/100/100, include
   {lib,hooks,components}/**, exclude components/ui/** and app/** with a comment stating WHY
   (vendored / shell), jsdom environment, setupFiles wiring @testing-library/jest-dom.
2. Tests for every uncovered path: XHR progress simulation for direct-upload, error-union
   narrowing, hook behaviors with mocked Query/socketless polling, component states (verdicts,
   envelopes, countdowns) via testing-library.
3. Remove dead branches from source instead of excluding.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- No snapshot-only tests for logic; assert behavior. Sequential runs, bounded workers.
- Conventional Commits per chunk: `test(web): <area> unit coverage (9.2)`.

Verification:
- `pnpm --filter web test:cov` prints 100 on all four metrics.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/6).
2. Update the P9 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 9.2 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 9.3: Full e2e + Playwright smoke

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 9.1

#### Description

E2E coverage of **every** HTTP route (all controllers, all error paths, the DTO reject path of
every Zod schema) against Testcontainers MinIO, plus the Playwright journey smoke for the web app,
and the CI jobs for both.

#### Acceptance criteria

- [ ] Per-feature e2e specs cover every route in the spec §11.1 catalogue at least once, including 404/400/413/415/422 paths and each Zod reject through the global pipe.
- [ ] Testcontainers MinIO lifecycle helpers (per-file container or shared with isolation) keep specs independent and re-runnable.
- [ ] Playwright: boot the stack (`webServer` + compose), a journey suite covering shell load, vault browse, upload with strategy chip, direct-upload confirm, error explorer render.
- [ ] CI jobs `e2e` and `web-build` (with the Playwright smoke) added and green.

#### Files to create / modify

- `apps/api/test/*.e2e-spec.ts`, `test/helpers/*`, `apps/web/playwright.config.ts`, `apps/web/e2e/*`, `.github/workflows/ci.yml`

#### Agent prompt

```
You are a senior test engineer building exhaustive end-to-end coverage.

PROJECT: nest-storage-example. Every HTTP route and every documented error path must be proven
through the real app (supertest) against a real MinIO (Testcontainers); the dashboard gets a
Playwright journey smoke.

CURRENT PHASE: 9, Task 9.3 of 6 (MIDDLE).

PRECONDITIONS
- Task 9.1 done; the P5 signed e2e helpers exist for reuse.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §11.1 (the full route catalogue: your checklist), §21
- Testcontainers Node + Playwright current official docs (verify APIs)

TASK
Write the route-exhaustive e2e suites, the Playwright smoke, and wire both into CI.

DELIVERABLES
1. test/helpers: createTestApp (real global pipe + filter exactly as production), MinIO container
   manager (with the setup.sh bootstrap logic replicated), fixture builders.
2. Per-feature specs: vault (all 10 routes), uploads (6), signed (5 incl. abort), validation,
   scanner, tenants, errors (the 17-code walk moved/extended here), system (5). Assert status,
   body shape, and the envelope on every failure path; every Zod schema's reject path via a real
   bad request.
3. Playwright: config with webServer bootping compose; the 5-journey suite; artifacts on failure.
4. CI: `e2e` job (Docker-enabled runner, sequential after unit) and `web-build` job including the
   Playwright smoke; job names stable.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- One container at a time; bounded workers; specs independent. No route left unasserted.
- Conventional Commits per chunk: `test(e2e): <area> flows (9.3)` / `ci(repo): e2e and web jobs (9.3)`.

Verification:
- `pnpm --filter api test:e2e` green twice consecutively.
- `pnpm --filter web exec playwright test` green locally; CI green on the branch.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/6).
2. Update the P9 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 9.3 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 9.4: Stryker mutation

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 9.2, 9.3

#### Description

Mutation testing as the final layer: api at `break: 100` (zero survivors), web at `break: 90`
(`lib/**` held to 100), with the `docs/stryker/` baseline, history, and equivalent-mutant records.

#### Acceptance criteria

- [ ] `apps/api/stryker.config.json` (jest runner, typescript checker, perTest coverage, mutate `src/**` minus modules/dto/d.ts/main, thresholds high 100 / low 100 / break 100, incremental) + a stryker-scoped jest config.
- [ ] `apps/web/stryker.config.json` (vitest runner, `ignoreStatic: true`, mutate `lib/**` + `components/**` minus tests/ui, thresholds high 100 / low 95 / break 90).
- [ ] Survivors killed with behavioral assertions; the only exceptions are proven equivalents, each with `// Stryker disable next-line <Mutator>: <reason>` AND a row in `docs/stryker/BASELINE.md`.
- [ ] `docs/stryker/` (BASELINE, HISTORY, notes) committed; `mutation` scripts + CI jobs wired.

#### Files to create / modify

- `apps/api/stryker.config.json`, `apps/api/jest.stryker.config.ts`, `apps/web/stryker.config.json`, `docs/stryker/*`, `.github/workflows/ci.yml`

#### Agent prompt

```
You are a senior test engineer running a mutation-hardening session.

PROJECT: nest-storage-example. Mutation is the assertiveness gate on top of 100% coverage: api
break 100 (zero survivors), web break 90 with lib/** at 100. Survivors die by behavioral
assertions; only proven equivalents may be disabled, each documented.

CURRENT PHASE: 9, Task 9.4 of 6 (MIDDLE).

PRECONDITIONS
- Tasks 9.2 + 9.3 done (coverage + e2e green): mutation runs LAST.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md Appendix B (thresholds)
- Stryker official docs for jest-runner/vitest-runner current options (verify APIs)

TASK
Configure Stryker for both apps, run the baseline, harden to the thresholds, document everything.

DELIVERABLES
1. The two stryker configs + the api stryker-scoped jest config (unit specs only, coverage off,
   tsconfig.spec transform).
2. Baseline run per app; kill survivors by strengthening assertions on observable behavior; for
   each genuine equivalent: inline Stryker disable with reason + a BASELINE.md table row.
3. docs/stryker/BASELINE.md (scores + survivor inventory), HISTORY.md (append-only run log).
4. Scripts `mutation` / `mutation:incremental` per app; CI jobs mutation:api / mutation:web
   (sequential, after e2e); .stryker-tmp and reports git/lint/prettier-ignored.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never lower a threshold to pass; never disable a killable mutant. One mutation run at a time
  (they are CPU-heavy); bounded concurrency per Stryker config.
- Conventional Commits per chunk: `test(mutation): <app> hardening (9.4)`.

Verification:
- `pnpm --filter api mutation` passes at break 100 (0 survivors).
- `pnpm --filter web mutation` passes at break 90 with lib/** 100.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/6).
2. Update the P9 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 9.4 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 9.5: Export audit, README, go-public checklist

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 9.4

#### Description

The coverage-matrix enforcement (`audit-library-exports.mjs` + CI job), the polished public README
in the sibling house style, and the go-public checklist.

#### Acceptance criteria

- [ ] `scripts/audit-library-exports.mjs`: parses the linked library's `dist/{server,shared}/index.d.ts` export names, word-boundary-searches `apps/`, fails on any undemonstrated export unless listed in `.audit-ignore.json` with a reason; `pnpm audit:exports` + CI job green.
- [ ] README: centered header, badges (build, license, coverage claim, library link), "What's inside" checklist mapping to the coverage matrix, Quick Start (infra + dev), endpoint table, curl journeys (upload → browse → signed GET; direct upload → confirm; infected marker rejection), architecture ASCII.
- [ ] Go-public checklist executed or explicitly deferred to the operator: flip visibility, confirm CodeQL + Scorecard activate, badges resolve, `file:` → `^0.1.0` swap documented as pending library publish.
- [ ] `CHANGELOG.md` 0.1.0 entry.

#### Files to create / modify

- `scripts/audit-library-exports.mjs`, `.audit-ignore.json`, `README.md`, `CHANGELOG.md`, `.github/workflows/ci.yml`

#### Agent prompt

```
You are a senior open-source maintainer finishing a reference repository.

PROJECT: nest-storage-example. The export audit turns the Feature Coverage Matrix into a CI gate;
the README is the public face in the sibling house style; the go-public checklist activates the
conditional security workflows.

CURRENT PHASE: 9, Task 9.5 of 6 (MIDDLE).

PRECONDITIONS
- Task 9.4 done; all gates green.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §7 (the matrix the audit enforces), §22
- The sibling nest-cache-example README (house style: header, badges, checklist, journeys)

TASK
Ship the audit script + CI job, the README, the changelog entry, and run the go-public checklist.

DELIVERABLES
1. scripts/audit-library-exports.mjs (zero-dep Node: node:fs/node:path only): extract export
   identifiers from both d.ts files, search apps/ word-boundary, report undemonstrated exports,
   exit non-zero unless ignored with a reason in .audit-ignore.json; root script audit:exports;
   CI job export-usage.
2. README.md per the acceptance criteria, matrix summary linking spec §7, three documented curl
   journeys with real commands.
3. CHANGELOG 0.1.0. Go-public checklist in the PR body: gh repo edit --visibility public is an
   OPERATOR-CONFIRMED action; if authorization is unavailable, mark deferred with the exact
   command and what will activate (CodeQL, Scorecard, badges).

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Zero-dependency script (supply-chain: it runs in CI). Public-grade wording; no em dashes.
- Conventional Commit: `docs(repo): readme, export audit and release readiness (9.5)`.

Verification:
- `pnpm audit:exports` exits 0 with every export demonstrated or reasoned-ignored.
- README links resolve; CI fully green including export-usage.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/6).
2. Update the P9 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 9.5 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 9.6: Phase close

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 9.1-9.5

#### Description

The roadmap-closing audit: every plan Definition of Done re-verified, dashboards finalized, PR +
GitHub Copilot review, merge with the full CI matrix green.

#### Acceptance criteria

- [ ] Full gate on a clean clone: install, lint, typecheck, unit 100% both apps, e2e, Playwright, mutation thresholds, export audit.
- [ ] Plan §1 shows 10/10 phases ✅ and 54/54 tasks; the README badges reflect reality.
- [ ] PR merged squash with Copilot findings addressed and CI green; branch deleted; the repository is release-ready (public flip done or explicitly deferred).

#### Files to create / modify

- `docs/tasks/phase-09-quality-docs-readiness.md`, `docs/DEVELOPMENT_PLAN.md`, `docs/tasks/README.md`

#### Agent prompt

```
You are a senior release engineer closing the final phase of a roadmap.

PROJECT: nest-storage-example. Repo: github.com/bymaxone/nest-storage-example.

CURRENT PHASE: 9, Task 9.6 of 6 (LAST: phase close, closes the roadmap).

PRECONDITIONS
- Tasks 9.1-9.5 ✅ on branch feat/phase-09-quality-docs-readiness; full CI green.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §5 (P9 Definition of Done), §6 (Update Protocol), Appendix B
- docs/tasks/README.md (Branch & PR workflow)

TASK
Run the complete clean-clone gate, finalize every dashboard, open the PR, obtain and resolve the
GitHub Copilot review, merge, and report the roadmap complete.

DELIVERABLES
1. Clean clone into a temp dir: install, lint, typecheck, test:cov both apps (100 x4), test:e2e,
   Playwright, mutation both apps, audit:exports: ALL green, sequentially.
2. Finalize this phase file, plan §1 (P9 ✅, 10/10 phases, 54/54 tasks, active phase: none,
   status: complete), README mirror.
3. `gh pr create --title "feat(quality): phase 9, library-grade quality bar and release readiness" --body <summary + gate evidence>`;
   request the GitHub Copilot review; address EVERY finding.
4. `gh pr merge --squash --delete-branch` with CI green; `git switch main && git pull`; final
   dashboard commit `docs(plan): mark P9 complete, roadmap done`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with a failing check; sequential suite execution only.

Verification:
- PR MERGED; remote branch gone; plan §1 shows 10/10 phases ✅.

Completion Protocol:
1. Status ✅ everywhere; header Progress 6/6, phase ✅.
2. Update plan §1 + README mirror (roadmap complete).
3. Append `- 9.6 ✅ YYYY-MM-DD: roadmap complete, PR #<n>`.
4. Commit dashboards on main.
```

## Completion log

<!-- append lines: - N.M ✅ YYYY-MM-DD: summary -->

- 9.1 ✅ 2026-07-07: api unit suite at 100/100/100/100 (682 stmts, 269 branches, 202 funcs, 642 lines; 369 tests). Added app.factory.spec.ts (NestFactory spy) so the bootstrap seam is unit-proven; trimmed collectCoverageFrom exclusions to the documented *.module.ts / main.ts / *.d.ts only. Unit tsconfig keeps emitDecoratorMetadata off; zero ignore/suppression comments.
