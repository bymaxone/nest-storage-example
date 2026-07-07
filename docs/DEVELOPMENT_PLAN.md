# nest-storage-example: Development Plan

> **Scope:** the master phased plan for building `nest-storage-example`, the reference application for [`@bymax-one/nest-storage`](https://github.com/bymaxone/nest-storage).
> **Source of truth:** the product spec is [`TECHNICAL_SPECIFICATION.md`](TECHNICAL_SPECIFICATION.md). This file is the execution roadmap that decomposes it; per-phase task files live under [`tasks/`](tasks/).
> **Targeted library version:** `@bymax-one/nest-storage@^0.1.0` (consumed via local `file:` link until published to npm).
> **Document version:** 1.0, authored before implementation.
> **Last updated:** 2026-07-06

**Status legend:** 📋 ToDo · 🔄 In Progress · 👀 Review · ✅ Done · ⛔ Blocked · 🟡 Partial

---

## Table of Contents

- [1. Progress Dashboard](#1-progress-dashboard)
- [2. Dependency Graph](#2-dependency-graph)
- [3. Parallelization Notes](#3-parallelization-notes)
- [4. Global Conventions](#4-global-conventions)
- [5. Phase Details](#5-phase-details)
- [6. Update Protocol](#6-update-protocol)
- [Appendix A: Environment Variable Registry](#appendix-a-environment-variable-registry)
- [Appendix B: Quality Gates](#appendix-b-quality-gates)

---

## 1. Progress Dashboard

> **Progress:** 3 / 10 phases complete (30%) · 21 / 54 tasks
> **Active phase:** P3 core-object-operations
> **Blockers:** none

| ID  | Phase                     | Tasks file                              | Status         | Progress | Size | Last updated |
| --- | ------------------------- | --------------------------------------- | -------------- | -------- | ---- | ------------ |
| P0  | repo-foundation-ci        | `phase-00-repo-foundation-ci.md`        | ✅ Done        | 6/6      | M    | 2026-07-07   |
| P1  | minio-stack-library-link  | `phase-01-minio-stack-library-link.md`  | ✅ Done        | 5/5      | M    | 2026-07-07   |
| P2  | api-skeleton-wiring       | `phase-02-api-skeleton-wiring.md`       | ✅ Done        | 6/6      | L    | 2026-07-07   |
| P3  | core-object-operations    | `phase-03-core-object-operations.md`    | 🔄 In Progress | 4/5      | L    | 2026-07-07   |
| P4  | listing-lifecycle         | `phase-04-listing-lifecycle.md`         | 📋 ToDo        | 0/5      | M    | 2026-07-06   |
| P5  | signed-urls-direct-upload | `phase-05-signed-urls-direct-upload.md` | 📋 ToDo        | 0/5      | M    | 2026-07-06   |
| P6  | validation-scanner        | `phase-06-validation-scanner.md`        | 📋 ToDo        | 0/5      | M    | 2026-07-06   |
| P7  | tenants-advanced-errors   | `phase-07-tenants-advanced-errors.md`   | 📋 ToDo        | 0/5      | M    | 2026-07-06   |
| P8  | web-dashboard             | `phase-08-web-dashboard.md`             | 📋 ToDo        | 0/6      | L    | 2026-07-06   |
| P9  | quality-docs-readiness    | `phase-09-quality-docs-readiness.md`    | 📋 ToDo        | 0/6      | L    | 2026-07-06   |

---

## 2. Dependency Graph

```
P0 ──► P1 ──► P2 ──► P3 ──► P4 ──┐
                     │           │
                     ├──► P5 ────┤
                     │           ├──► P8 ──► P9
                     ├──► P6 ────┤
                     │     │     │
                     └─────┴► P7 ┘
```

Reading: everything funnels through the API wiring (P2). The object-operation phases (P3, then P4)
form the backbone. P5 (signed URLs) and P6 (validation + scanner) branch off P3. P7 (errors
explorer, provider quirks) needs P6 because the error catalogue includes validation and scanner
codes. The dashboard (P8) needs the whole backend surface (P4 through P7). Quality and docs (P9)
close the roadmap.

## 3. Parallelization Notes

- **Execution is sequential by default** (one implementer at a time, one PR per phase). The
  code-level independence documented here exists so review and future maintenance understand the
  real coupling, not to encourage concurrent implementers.
- After P3 lands, **P5 and P6 touch disjoint modules** (`signed/` vs `validation-lab/` +
  `scanner-lab/`) and could be code-parallel; P7 must wait for P6.
- **Test suites never run in parallel across packages**: one suite at a time, Jest/Vitest
  `maxWorkers: '50%'` baked into the configs, `NODE_OPTIONS=--max-old-space-size=4096` as a guard,
  and one Testcontainers MinIO container at a time.
- P8 is a joining point: it starts only when P4 through P7 are ✅.

## 4. Global Conventions

Applies to every phase; the task files repeat the load-bearing ones per task.

1. **English only** in code, comments, JSDoc, identifiers, commits, and docs. Conventional Commits
   (`feat/fix/chore/docs/refactor/test/ci(scope): subject`).
2. **TypeScript 5.9 strict** (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), zero
   `any`, zero suppression comments (`@ts-ignore`, `eslint-disable`).
3. **Clean Code:** functions ≤ 50 lines, files ≤ 800 (200-400 typical), `@fileoverview` + `@layer`
   header per file, imperative JSDoc on every export.
4. **Timeless comments:** never reference a plan phase or task number in committed source or
   config; a doc-section reference (`spec §12.4`) is fine.
5. **Library consumed as a published artifact:** `file:../../../nest-storage` link resolving
   through `dist/` + `exports` (never a workspace member, never a `paths` alias); flips to
   `^0.1.0` after publish.
6. **Coverage 100%** on all four metrics for both apps once the quality phase lands; every phase
   before that ships its own tests green (TDD as the working mode, no test debt carried forward).
7. **Branch + PR discipline:** each phase starts with `git switch -c feat/phase-NN-<slug>` (never
   `git checkout -b`) and ends with a phase-close task that opens the PR via `gh pr create`,
   requests a **GitHub Copilot code review**, addresses every finding, and merges only with CI
   green (`--squash --delete-branch`).
8. **No AI attribution anywhere:** no `Co-Authored-By`, no "Generated with" in commits, PR titles,
   PR bodies, or comments.
9. **CI from day one:** the `ci` workflow (lint, typecheck, format) exists from P0 and every later
   job joins incrementally; **CodeQL and OpenSSF Scorecard run conditionally**
   (`if: ${{ !github.event.repository.private }}`) so they are inert while the repository is
   private and activate on the public flip.
10. **No placeholders:** no `.gitkeep`, no empty directories, no dead scaffolding.

---

## 5. Phase Details

### P0: repo-foundation-ci (M)

- **Goal:** a buildable pnpm workspace with the full Bymax toolchain and CI gating the very first PR.
- **Scope (in):** root `package.json` (workspaces `apps/*`, engines Node ≥ 24, scripts), `pnpm-workspace.yaml`, `.nvmrc`, `.npmrc`, `tsconfig.base.json` strict, ESLint 9 flat + Prettier 3, husky + commitlint + lint-staged + `.gitmessage`, Renovate, LICENSE (MIT), README stub, CHANGELOG, `.github/workflows/ci.yml` (lint + typecheck + format:check) plus conditional `codeql.yml` and `scorecard.yml`.
- **Scope (out):** application code, Docker, the library link.
- **Definition of Done:**
  - `pnpm install && pnpm lint && pnpm typecheck && pnpm format:check` green on a clean clone.
  - The `commit-msg` hook rejects a non-Conventional message.
  - CI green on the phase PR; CodeQL/Scorecard jobs skip cleanly while private.
- **References:** spec §5, §6, §22. Matrix rows: none (tooling).

### P1: minio-stack-library-link (M)

- **Goal:** `docker compose up -d --wait` brings up MinIO with the three buckets bootstrapped, and both apps consume the library with type-resolving subpath probes.
- **Scope (in):** `docker-compose.yml` (minio + one-shot `minio-setup` running `docker/minio/setup.sh`: create `vault`/`vault-archive`/`vault-versioned`, enable versioning, seed sample objects), `.env.example` for api and web, root `infra:*` scripts, `apps/api` + `apps/web` package stubs with the `file:` link, the api dual-subpath probe (`.` + `./shared` + peers) and the web `./shared`-only probe (no peers, the zero-dep proof).
- **Scope (out):** any NestJS/Next.js application logic.
- **Definition of Done:**
  - `pnpm infra:up` reports MinIO healthy; the three buckets exist; `vault-versioned` has versioning enabled.
  - `pnpm typecheck` resolves both subpaths in both apps; the web package declares none of the library's peers.
- **References:** spec §8, §15, §20, Appendix A. Matrix rows: 59, 60 (probes), infra for all.

### P2: api-skeleton-wiring (L)

- **Goal:** a booting NestJS 11 service with the canonical `forRootAsync` wiring, the exception filter, health, and the system introspection surface.
- **Scope (in):** `apps/api` Nest app (`main.ts` with CORS + shutdown hooks + global pipe/filter), `config/env.schema.ts` (Zod, aggregated fail-fast), `config/storage.config.ts` (`buildStorageOptions`, the copy-paste artifact of spec §9.2), `app.module.ts` registration, `common/` (StorageExceptionFilter, ZodValidationPipe), `system/` (`GET /health`, `GET /system/config` redacted introspection via `BYMAX_STORAGE_OPTIONS`, `GET /system/recipes` rendering `providerRecipes` with quirk annotations).
- **Scope (out):** vault/upload/signed routes (later phases).
- **Definition of Done:**
  - `pnpm --filter api dev` boots against Docker MinIO; `GET /health` returns `{ status, latencyMs, bucket }`.
  - `GET /system/config` shows resolved options with credentials redacted; `GET /system/recipes` renders all six recipes.
  - Boot with a broken env prints one aggregated Zod report and exits non-zero.
- **References:** spec §9, §10, §18, §19. Matrix rows: 1, 3, 4, 5, 6, 19, 50, 54.

### P3: core-object-operations (L)

- **Goal:** the full write/read path: every upload strategy and every download shape, with live progress.
- **Scope (in):** `uploads/` (single Buffer, multipart with `onProgress` session store, stream with known/unknown size, `idempotencyKey`, per-upload SSE override incl. `'NONE'`), `vault/` download routes (stream proxy, buffer preview, range, versionId against the versioned bucket), automatic-header round-trip assertions.
- **Scope (out):** listing/folders (P4), signed URLs (P5).
- **Definition of Done:**
  - A 1 MiB upload reports `multipart: false`; a 12 MiB upload reports `multipart: true` with progress snapshots; an unknown-size stream forces multipart.
  - Second idempotent upload returns `fromIdempotencyCache: true` without a provider write.
  - Range download returns exactly the requested bytes; versioned download returns a prior version.
- **References:** spec §11.1, §12.1-§12.3. Matrix rows: 10, 12, 15, 20-31.

### P4: listing-lifecycle (M)

- **Goal:** the vault becomes browsable and manageable: folders, pagination, and every lifecycle operation.
- **Scope (in):** `vault/` list (prefix, `maxKeys`, continuation cursor, `delimiter: '/'` + `commonPrefixes` folder navigation), `head()` detail, `exists()`, idempotent `delete()`, `deleteMany()` with per-key failure rendering, `copy()` same-bucket and to `vault-archive`, `getPublicUrl()` plain + CDN forms, seed journeys used by the dashboard.
- **Definition of Done:**
  - Pagination walks a 25-object seed with `maxKeys=10` in three pages; folder listing aggregates `commonPrefixes`.
  - Bulk delete of a mixed list reports `{ deleted, failed }` accurately; repeat single delete does not throw.
  - Cross-bucket copy lands in `vault-archive` and `exists()` confirms both sides.
- **References:** spec §11.1, §15. Matrix rows: 7, 32-39.

### P5: signed-urls-direct-upload (M)

- **Goal:** the presigned surface, end to end from a real client, including the honest validation-bypass boundary.
- **Scope (in):** `signed/` routes (download-url with response overrides, upload-url with `maxSizeBytes`, multipart-urls with abort path), TTL clamp demo (requested vs effective), `ttlSeconds ≤ 0` rejection, `POST /signed/confirm` (head + registration; scanner verify joins in P6 and the seam is left explicit), real-fetch integration tests that PUT/GET against MinIO using the issued URLs.
- **Definition of Done:**
  - A browser-grade `fetch` PUT with the returned `requiredHeaders` succeeds; an over-limit body is rejected by the length policy.
  - Requesting 24 h on the 1 h cap yields a clamped `expiresAt`; `ttlSeconds: 0` returns `STORAGE_SIGNED_URL_TTL_INVALID`.
  - The multipart flow completes via `completeUrl` and the abort path leaves no orphan parts.
- **References:** spec §12.4, §12.5, §17. Matrix rows: 11, 40-46.

### P6: validation-scanner (M)

- **Goal:** the pluggable upload pipeline, every stage demonstrated failing independently.
- **Scope (in):** `validation-lab/` (whitelist with wildcard, `maxSizeBytes` 413, `PdfMagicByteValidator` with `readBytes`), `scanner-lab/` (`MarkerFileScanner`, pre/post modes with post-upload removal proof, `rejectOnUnknown` both values, config introspection), scanner verify wired into `POST /signed/confirm`.
- **Definition of Done:**
  - `application/zip` → 415; oversized → 413; fake PDF → 400 with the validator reason in `details`.
  - `X-DEMO-INFECTED` marker → 422 with threat name; in post-upload mode the object is provably removed (`exists()` false).
  - `X-DEMO-UNKNOWN` passes with a warning by default and returns 422 when `rejectOnUnknown: true`.
- **References:** spec §16. Matrix rows: 13, 14, 47-53.

### P7: tenants-advanced-errors (M)

- **Goal:** multi-tenant key scoping, the raw-client escape hatch, provider quirks, and the complete error explorer.
- **Scope (in):** `tenants/` (prefix-composed keys under the instance `keyPrefix`, per-tenant listing and clearing with isolation proof), `errors-demo/` triggering all 17 `STORAGE_ERROR_CODES` deterministically (including the unconfigured-instance 503 probe, timeout via unroutable endpoint, part-too-small, bucket-undefined, multipart-aborted on the raw presigned path), the checksum-trap toggle (spec §12.7), the ACL honesty card (spec §12.6), `system/versioning` via `BYMAX_STORAGE_S3_CLIENT`.
- **Definition of Done:**
  - Every error code returns its documented HTTP status and envelope through the filter; the explorer table is exhaustive.
  - Clearing tenant A leaves tenant B intact; keys render with the full `{keyPrefix}/{tenant}/...` composition.
  - The checksum toggle demonstrates the provider rejection and recovery.
- **References:** spec §12.6-§12.8, §18. Matrix rows: 2 (sync boot in tests), 8, 9, 16, 17, 18, 55-58.

### P8: web-dashboard (L)

- **Goal:** the Next.js 16 dashboard, visually identical to the sibling reference apps, covering every backend surface.
- **Scope (in):** app skeleton with the **verbatim design-system files**, shell (topbar + grouped sidebar, `nest-storage-example` wordmark), `lib/api-client.ts` typed by `STORAGE_ERROR_CODES` from `./shared`, and the ten pages of spec §13.2 with the signature components (§13.3), including the direct-upload page performing real presigned PUTs from the browser.
- **Definition of Done:**
  - `pnpm --filter web build` succeeds; the shared-subpath import ships no NestJS/SDK code to the client bundle.
  - Every page renders live data end to end against the running API; a screenshot beside a sibling app is indistinguishable in chrome.
  - Upload progress, TTL countdown, verdict cards, and the envelope panel all render real states.
- **References:** spec §13, §14, §17. Matrix rows: UI for 20-60.

### P9: quality-docs-readiness (L)

- **Goal:** the full library-grade quality bar plus public-facing docs and the go-public checklist.
- **Scope (in):** unit suites to **100/100/100/100** for api (Jest) and web (Vitest); e2e of every HTTP route and error path (supertest + Testcontainers MinIO) plus the real-fetch signed-URL suite; Stryker (api `break: 100`, web `break: 90`, `docs/stryker/` baseline + history); `scripts/audit-library-exports.mjs` + CI `export-usage` job; the polished README (badges, quick start, endpoints, matrix summary, curl journeys); the repo-public checklist (flip visibility, confirm CodeQL/Scorecard activate, badges resolve).
- **Definition of Done:**
  - `pnpm --filter api test:cov` and `pnpm --filter web test:cov` report 100 on all four metrics with zero skips and zero ignore comments.
  - `pnpm test:e2e` covers every route; `pnpm audit:exports` exits 0 (every library export demonstrated or ignored with a written reason).
  - Mutation thresholds hold; README renders; the public-flip checklist is executed or explicitly deferred by the operator.
- **References:** spec §21, §22, Appendix B. Matrix rows: audit across all.

---

## 6. Update Protocol

When any phase or task changes state:

1. Update the task's row and block in its `docs/tasks/phase-NN-*.md` (status, checkboxes, header progress counter, completion log).
2. Update that phase's row in the [§1 Progress Dashboard](#1-progress-dashboard) (status, progress, last updated) and the global counters in the blockquote.
3. This file is the **canonical dashboard**; [`tasks/README.md`](tasks/README.md) only mirrors it. Update the mirror in the same edit.
4. Phase status flips to ✅ only when every task is done, the Definition of Done holds, and the phase PR is merged with CI green.
5. Commit the dashboard update as `docs(plan): update P<N> status to <status>`.
6. Never mark a task done with failing verification; no `--no-verify`, no threshold lowering, no suppression comments to force a gate.
7. Changing the phase decomposition (add/split/remove) requires updating §1, §2, §3, and §5 in the same edit.

---

## Appendix A: Environment Variable Registry

Canonical table in [`TECHNICAL_SPECIFICATION.md` §9.1](TECHNICAL_SPECIFICATION.md#9--configuration--environment).
API: `NODE_ENV`, `PORT` (3001), `WEB_ORIGIN`, `STORAGE_ENDPOINT`, `STORAGE_REGION`,
`STORAGE_BUCKET`, `STORAGE_ARCHIVE_BUCKET`, `STORAGE_VERSIONED_BUCKET`, `STORAGE_ACCESS_KEY_ID`,
`STORAGE_SECRET_ACCESS_KEY`, `STORAGE_FORCE_PATH_STYLE`, `STORAGE_PUBLIC_BASE_URL`,
`STORAGE_CDN_BASE_URL`, `STORAGE_KEY_PREFIX`, `STORAGE_SSE`, `STORAGE_CHECKSUM_MODE`,
`STORAGE_MAX_TTL_SECONDS`, `STORAGE_MULTIPART_THRESHOLD`, `SCANNER_MODE`,
`SCANNER_REJECT_ON_UNKNOWN`, `UPLOAD_MAX_SIZE_BYTES`. Web: `NEXT_PUBLIC_API_URL`. Every variable is
Zod-validated in `apps/api/src/config/env.schema.ts`.

## Appendix B: Quality Gates

| Gate            | Tool / config                                              | Threshold                         | Enforced from          |
| --------------- | ---------------------------------------------------------- | --------------------------------- | ---------------------- |
| Lint            | ESLint 9 flat                                              | zero errors                       | CI `lint` (P0)         |
| Typecheck       | `tsc --noEmit` per package                                 | zero errors                       | CI `typecheck` (P0)    |
| Format          | Prettier `--check`                                         | clean                             | CI `format` (P0)       |
| API unit + cov  | Jest (`tsconfig.spec.json`, decorators metadata off)       | **100/100/100/100**               | CI `test:cov` (P9)     |
| Web unit + cov  | Vitest + coverage-v8                                       | **100/100/100/100**               | CI `test:cov` (P9)     |
| API e2e         | supertest + Testcontainers MinIO + real-fetch signed URLs  | every route + every error path    | CI `e2e` (P9)          |
| Web build/smoke | `next build` + Playwright journeys                         | green                             | CI `web-build` (P9)    |
| API mutation    | Stryker (jest runner)                                      | `break: 100`                      | CI `mutation:api` (P9) |
| Web mutation    | Stryker (vitest runner)                                    | `break: 90` (`lib/**` at 100)     | CI `mutation:web` (P9) |
| Export usage    | `scripts/audit-library-exports.mjs` + `.audit-ignore.json` | every library export demonstrated | CI `export-usage` (P9) |
| CodeQL          | `codeql.yml`, **conditional on public visibility**         | no new alerts                     | activates on flip      |
| Scorecard       | `scorecard.yml`, **conditional on public visibility**      | reported                          | activates on flip      |
| Pre-commit      | husky + lint-staged                                        | prettier + eslint --fix on staged | local (P0)             |
| Commit message  | commitlint (`config-conventional`)                         | Conventional Commits              | local (P0)             |

> **Memory safety.** One suite at a time, `maxWorkers: '50%'` in every Jest/Vitest config,
> `NODE_OPTIONS=--max-old-space-size=4096`, one Testcontainers MinIO at a time, and never a fan-out
> of parallel test agents.
