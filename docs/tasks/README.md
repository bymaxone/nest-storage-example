# Task Files: Index & Conventions

> Per-phase task breakdowns for [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md). The plan's
> [§1 Progress Dashboard](../DEVELOPMENT_PLAN.md#1-progress-dashboard) is **canonical**; this index
> only mirrors it. The product spec is [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md).

**Status legend:** 📋 ToDo · 🔄 In Progress · 👀 Review · ✅ Done · ⛔ Blocked · 🟡 Partial

## Phase files

| Phase | File                                    | Tasks     | Status  | Scope                                                                                                |
| ----- | --------------------------------------- | --------- | ------- | ---------------------------------------------------------------------------------------------------- |
| P0    | `phase-00-repo-foundation-ci.md`        | 6/6       | ✅ Done | pnpm workspace, toolchain, husky/commitlint, **CI from day one** (conditional CodeQL/Scorecard)      |
| P1    | `phase-01-minio-stack-library-link.md`  | 5/5       | ✅ Done | docker-compose MinIO (3 buckets, versioning, seed) + `file:` link + subpath probes                   |
| P2    | `phase-02-api-skeleton-wiring.md`       | 6/6       | ✅ Done | NestJS 11 skeleton, Zod env, canonical `forRootAsync`, filter, health, recipes                       |
| P3    | `phase-03-core-object-operations.md`    | 5/5       | ✅ Done | uploads (single/multipart/stream/progress/idempotency/SSE) + downloads (stream/buffer/range/version) |
| P4    | `phase-04-listing-lifecycle.md`         | 5/5       | ✅ Done | list/folders/pagination, head/exists, delete/deleteMany, copy, public URLs                           |
| P5    | `phase-05-signed-urls-direct-upload.md` | 5/5       | ✅ Done | presigned GET/PUT/multipart, TTL clamp, direct upload + confirm                                      |
| P6    | `phase-06-validation-scanner.md`        | 0/5       | 🔄      | MIME/size/magic-byte validation + marker scanner (modes, rejectOnUnknown)                            |
| P7    | `phase-07-tenants-advanced-errors.md`   | 0/5       | 📋 ToDo | tenant prefixes, raw S3Client ops, all 17 error codes, provider quirks                               |
| P8    | `phase-08-web-dashboard.md`             | 0/6       | 📋 ToDo | Next.js 16 dashboard, verbatim design system, all pages                                              |
| P9    | `phase-09-quality-docs-readiness.md`    | 0/6       | 📋 ToDo | 100% unit coverage, full e2e, Stryker, export audit, README, public-flip checklist                   |
|       | **Total**                               | **32/54** | 🔄      |                                                                                                      |

## Task-file anatomy

Each `phase-NN-*.md` contains: header blockquote (status, progress, last updated, source links) ·
Context · Rules-of-phase · Reference docs · Task index table (`| ID | Task | Status | Priority |
Size | Depends on |`, IDs `N.M`) · one block per task (`### Task N.M: title`, metadata bullets,
Description, Acceptance criteria checkboxes, Files to create / modify, **Agent prompt** in a
four-backtick fence, fully self-contained English) · an append-only Completion log.

## Branch & PR workflow (mandatory, one PR per phase)

1. The FIRST task of each phase creates the branch: `git switch -c feat/phase-NN-<slug>` (never
   `git checkout -b`).
2. Every task commits on that branch with Conventional Commits: `<type>(<scope>): <subject> (N.M)`.
3. The LAST task of each phase (phase close) audits the acceptance criteria, updates the
   dashboards, opens the PR via `gh pr create`, requests the **GitHub Copilot code review**,
   addresses every finding, and merges only with CI green (`gh pr merge --squash --delete-branch`).
4. **Never** add `Co-Authored-By`, "Generated with", or any AI-attribution line to commits, PR
   titles, PR bodies, or comments.

## Execution guidance for agents

- **Token economy:** read only your task's `### Task N.M` block plus its REQUIRED READING list;
  use `Read` offset/limit on large files; never load the whole spec or plan.
- **Docs-first:** verify any library or SDK API against the library README / type declarations
  before coding; never from memory.
- **Memory-safe testing:** run suites sequentially, `maxWorkers: '50%'`, one Testcontainers MinIO
  at a time; never fan out parallel test agents.
- **Self-update protocol (end of every task):** task status + checkboxes → task index row → file
  header progress → plan §1 dashboard row + global counters → completion log line → Conventional
  Commit. Never mark done with failing verification.

## Project-wide constraints (every task)

- TS strict, zero `any`, zero suppressions; functions ≤ 50 lines; files ≤ 800; `@fileoverview` +
  `@layer` header; imperative JSDoc on exports; every `it()` carries a scenario comment.
- Timeless comments: no plan-stage references in committed source or config.
- The library resolves as an external package (`file:` link through `dist/` + `exports`); never a
  workspace member or `paths` alias.
- English only. No em dashes in code or docs. No `.gitkeep`. Dev credentials only; the secret scan
  stays clean.
