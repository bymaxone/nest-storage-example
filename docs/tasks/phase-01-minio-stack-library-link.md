# Phase 1: minio-stack-library-link

> **Status**: 🔄 In Progress · **Progress**: 4 / 5 tasks · **Last updated**: 2026-07-07
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P1)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §8, §15, §20

## Context

P0 delivered the gated workspace. This phase brings up the storage substrate (MinIO with the three
buckets bootstrapped and versioning enabled on `vault-versioned`) and wires both future apps to
consume `@bymax-one/nest-storage` as an external package through its published artifact, proven by
typed subpath probes. At the end of the phase there is still no application logic, but
`pnpm infra:up && pnpm typecheck` proves the entire consumption path.

## Rules-of-phase

1. The library resolves through `dist/` + `package.json#exports` via the `file:../../../nest-storage`
   link; never a workspace member, never a `paths` alias. Published end-state: `^0.1.0`.
2. `apps/api` declares the library's six peers; `apps/web` declares NONE (the zero-dep `./shared`
   proof).
3. Buckets, versioning, and seed objects are created by the one-shot `minio-setup` service, never
   by hand.
4. Dev credentials only (`minioadmin`); ports bound to `127.0.0.1`.

## Reference docs

- `../TECHNICAL_SPECIFICATION.md` §8 (Library Consumption), §15 (Buckets), §20 (Local Stack), §9.1 (env)
- Library README + `dist/{server,shared}/index.d.ts` in the linked checkout (the API truth)

## Task index

| ID  | Task                                                          | Status  | Priority | Size | Depends on |
| --- | ------------------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 1.1 | Branch + docker-compose MinIO + bucket bootstrap script       | ✅ Done | P0       | M    | none       |
| 1.2 | Env examples + infra scripts verified                         | ✅ Done | P0       | S    | 1.1        |
| 1.3 | `apps/api` package: library link + peers + dual-subpath probe | ✅ Done | P0       | S    | 1.1        |
| 1.4 | `apps/web` package: library link + `./shared`-only probe      | ✅ Done | P0       | S    | 1.1        |
| 1.5 | Phase close: audit, dashboards, PR + Copilot review, merge    | 📋 ToDo | P0       | S    | 1.1-1.4    |

## Tasks

### Task 1.1: Branch + MinIO stack + bootstrap

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: none

#### Description

Compose file with MinIO and a one-shot `mc`-based setup service creating `vault`, `vault-archive`,
`vault-versioned` (versioning on), and seeding sample objects.

#### Acceptance criteria

- [x] Branch `feat/phase-01-minio-stack-library-link` created with `git switch -c`.
- [x] `docker-compose.yml`: `minio` (server + console, healthcheck, named volume, `127.0.0.1` ports 9000/9001) and `minio-setup` (`minio/mc`, `depends_on: service_healthy`, runs `docker/minio/setup.sh`).
- [x] `docker/minio/setup.sh`: idempotent; creates the 3 buckets, enables versioning on `vault-versioned`, seeds ~10 objects across `avatars/`, `invoices/`, `attachments/` prefixes.
- [x] `docker compose up -d --wait` exits 0; `vault-versioned` reports versioning enabled.

#### Files to create / modify

- `docker-compose.yml`, `docker/minio/setup.sh`

#### Agent prompt

```
You are a senior infrastructure engineer.

PROJECT: nest-storage-example, reference app for @bymax-one/nest-storage. Local S3-compatible
substrate is MinIO via Docker Compose. Repo: github.com/bymaxone/nest-storage-example.

CURRENT PHASE: 1 (minio-stack-library-link), Task 1.1 of 5 (FIRST).

PRECONDITIONS
- Phase 0 merged: pnpm workspace + CI exist on main; working tree clean.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §15 (Buckets & Storage Topology), §20 (Local Stack & Docker)
- MinIO official docs for `mc mb`, `mc version enable`, `mc cp` current syntax (verify, never from memory)

TASK
Create the branch, the compose file (minio + one-shot minio-setup), and the idempotent bootstrap
script that creates the three buckets, enables versioning on vault-versioned, and seeds sample
objects.

DELIVERABLES
1. `git switch -c feat/phase-01-minio-stack-library-link` (NEVER `git checkout -b`).
2. `docker-compose.yml` per spec §20: minio (command `server /data --console-address ":9001"`,
   MINIO_ROOT_USER/PASSWORD minioadmin, healthcheck, volume `minio-data`, ports bound to
   127.0.0.1) and minio-setup (image minio/mc, mounts `./docker/minio`, entrypoint the setup
   script, runs once after health).
3. `docker/minio/setup.sh` (POSIX sh, executable): `mc alias set local http://minio:9000 ...`,
   create buckets vault / vault-archive / vault-versioned if absent, `mc version enable
   local/vault-versioned`, seed small text/png sample objects under avatars/, invoices/,
   attachments/ prefixes (generate inline, no binary fixtures in git), print a summary.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Idempotent script (safe to re-run); no real credentials; English comments; timeless comments.
- Conventional Commit: `feat(infra): add minio stack with bucket bootstrap (1.1)`.

Verification:
- `docker compose up -d --wait` exits 0.
- `docker compose run --rm minio-setup` re-run exits 0 (idempotency).
- `docker compose exec -T minio mc version info local/vault-versioned` (or an mc run) shows versioning Enabled.

Completion Protocol:
1. Set this task's Status to ✅ in its block and in the Task index.
2. Tick all acceptance criteria checkboxes.
3. Increment the header Progress counter (n/5).
4. Update the P1 row in docs/DEVELOPMENT_PLAN.md §1 and mirror in docs/tasks/README.md.
5. Append to the Completion log: `- 1.1 ✅ YYYY-MM-DD: <summary>`.
6. Commit with the Conventional message above.
```

---

### Task 1.2: Env examples + infra scripts

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 1.1

#### Description

`.env.example` files covering the full Appendix A registry, and the root `infra:*` scripts verified
against the compose file.

#### Acceptance criteria

- [x] `apps/api/.env.example` lists every variable from spec §9.1 with the dev defaults and a one-line comment each.
- [x] `apps/web/.env.example` with `NEXT_PUBLIC_API_URL`.
- [x] Root `infra:up|down|nuke|logs` verified working; `infra:nuke` removes the volume.

#### Files to create / modify

- `apps/api/.env.example`, `apps/web/.env.example`, `package.json` (scripts confirmed)

#### Agent prompt

```
You are a senior backend engineer documenting configuration.

PROJECT: nest-storage-example. MinIO stack from Task 1.1 is up.

CURRENT PHASE: 1, Task 1.2 of 5 (MIDDLE).

PRECONDITIONS
- Task 1.1 done on branch feat/phase-01-minio-stack-library-link; compose stack healthy.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §9.1 (Environment variables) and Appendix A of docs/DEVELOPMENT_PLAN.md

TASK
Write both .env.example files (every registry variable, dev defaults, one-line comments) and verify
the root infra scripts against the real compose file.

DELIVERABLES
1. `apps/api/.env.example`: NODE_ENV, PORT, WEB_ORIGIN, STORAGE_ENDPOINT, STORAGE_REGION,
   STORAGE_BUCKET, STORAGE_ARCHIVE_BUCKET, STORAGE_VERSIONED_BUCKET, STORAGE_ACCESS_KEY_ID,
   STORAGE_SECRET_ACCESS_KEY, STORAGE_FORCE_PATH_STYLE, STORAGE_PUBLIC_BASE_URL,
   STORAGE_CDN_BASE_URL, STORAGE_KEY_PREFIX, STORAGE_SSE, STORAGE_CHECKSUM_MODE,
   STORAGE_MAX_TTL_SECONDS, STORAGE_MULTIPART_THRESHOLD, SCANNER_MODE, SCANNER_REJECT_ON_UNKNOWN,
   UPLOAD_MAX_SIZE_BYTES, each with the §9.1 dev default and a short comment.
2. `apps/web/.env.example`: NEXT_PUBLIC_API_URL=http://localhost:3001.
3. Run each root infra script once and fix any drift against the compose file.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Dev values only, never a real secret. English comments.
- Conventional Commit: `docs(infra): add env examples and verify infra scripts (1.2)`.

Verification:
- `pnpm infra:up && pnpm infra:logs --tail=1 && pnpm infra:down` all exit 0.
- Every §9.1 variable appears exactly once in apps/api/.env.example (spot-check with grep -c).

Completion Protocol:
1. Set this task's Status to ✅ in its block and in the Task index.
2. Tick all acceptance criteria checkboxes.
3. Increment the header Progress counter (n/5).
4. Update the P1 row in docs/DEVELOPMENT_PLAN.md §1 and mirror in docs/tasks/README.md.
5. Append to the Completion log: `- 1.2 ✅ YYYY-MM-DD: <summary>`.
6. Commit with the Conventional message above.
```

---

### Task 1.3: `apps/api` library link + dual-subpath probe

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 1.1

#### Description

`apps/api` package stub consuming the library via `file:` with all six peers, plus a typed probe
importing from both `.` and `./shared`.

#### Acceptance criteria

- [x] `apps/api/package.json`: `"@bymax-one/nest-storage": "file:../../../nest-storage"` plus peers `@nestjs/common ^11`, `@nestjs/core ^11`, `@aws-sdk/client-s3 ^3.700.0`, `@aws-sdk/lib-storage ^3.700.0`, `@aws-sdk/s3-request-presigner ^3.700.0`, `reflect-metadata ^0.2`; `tsconfig.json` extending the base.
- [x] `apps/api/src/library-probe.ts` imports `BymaxStorageModule`, `StorageService`, `SignedUrlService`, `providerRecipes` from `.` and `STORAGE_ERROR_CODES`, `DEFAULT_SIGNED_URL_TTL_SECONDS` from `./shared`, referencing each.
- [x] `pnpm --filter api exec tsc --noEmit` exits 0; peers resolve to a single copy.

#### Files to create / modify

- `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/library-probe.ts`

#### Agent prompt

```
You are a senior TypeScript / NestJS engineer wiring a reference app to consume an unpublished library.

PROJECT: nest-storage-example. The library @bymax-one/nest-storage lives as a sibling checkout at
../nest-storage (relative to the repo root), is dual ESM+CJS (tsup) with subpaths `.` (server) and
`./shared` (zero-dep), has `dependencies: {}`, and declares as PEERS: @nestjs/common ^11,
@nestjs/core ^11, @aws-sdk/client-s3 ^3.700.0, @aws-sdk/lib-storage ^3.700.0,
@aws-sdk/s3-request-presigner ^3.700.0, reflect-metadata ^0.2. Not yet on npm; consumed via file:
link resolving through its built dist/ + exports map (published end-state ^0.1.0).

CURRENT PHASE: 1, Task 1.3 of 5 (MIDDLE).

PRECONDITIONS
- Task 1.1 done on branch feat/phase-01-minio-stack-library-link.
- The sibling library checkout has a built dist/ (run `pnpm --dir ../nest-storage build` if missing).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §8 (Library Consumption), §4 (API inventory)
- ../nest-storage/dist/server/index.d.ts and dist/shared/index.d.ts export names (the truth; adjust probe imports to what actually ships)

TASK
Create the apps/api package stub with the library link + peers and a typed dual-subpath probe.

DELIVERABLES
1. `apps/api/package.json`: name `@nest-storage-example/api`, private, type module, the library
   file: link under dependencies, the six peers under dependencies (single-copy resolution), and a
   `typecheck` script.
2. `apps/api/tsconfig.json` extending ../../tsconfig.base.json (emitDecoratorMetadata +
   experimentalDecorators on, for the NestJS app to come).
3. `apps/api/src/library-probe.ts`: a runtime-inert, compile-time resolution proof importing from
   BOTH subpaths and referencing every symbol; JSDoc header explaining it exists so typecheck fails
   loudly if the exports map or dual build regresses. If a listed symbol does not exist in the
   shipped d.ts, use the closest real export and note it in the PR body (never invent APIs).

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- No workspace membership, no paths alias; the link must resolve dist/ + exports.
- TS strict, no any, no suppressions; timeless comments.
- Conventional Commit: `feat(api): consume nest-storage via file link with dual-subpath probe (1.3)`.

Verification:
- `pnpm install` exits 0 and links the library.
- `pnpm --filter @nest-storage-example/api exec tsc --noEmit` exits 0.
- `pnpm why @aws-sdk/client-s3` shows a single resolved copy.

Completion Protocol:
1. Set this task's Status to ✅ in its block and in the Task index.
2. Tick all acceptance criteria checkboxes.
3. Increment the header Progress counter (n/5).
4. Update the P1 row in docs/DEVELOPMENT_PLAN.md §1 and mirror in docs/tasks/README.md.
5. Append to the Completion log: `- 1.3 ✅ YYYY-MM-DD: <summary>`.
6. Commit with the Conventional message above.
```

---

### Task 1.4: `apps/web` library link + shared-only probe

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 1.1

#### Description

`apps/web` package stub consuming only `./shared`, declaring none of the peers: the zero-dependency
browser-path proof (matrix #59).

#### Acceptance criteria

- [x] `apps/web/package.json`: the library `file:` link only; NO NestJS/SDK peers declared.
- [x] `apps/web/lib/storage-shared-probe.ts` imports only from `@bymax-one/nest-storage/shared` (`STORAGE_ERROR_CODES`, default whitelist + TTL constants, `UploadResult` type), referencing each; no import from the bare server subpath anywhere in `apps/web`.
- [x] `pnpm --filter web exec tsc --noEmit` exits 0.

#### Files to create / modify

- `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/lib/storage-shared-probe.ts`

#### Agent prompt

```
You are a senior TypeScript / Next.js engineer proving a zero-dependency browser import path.

PROJECT: nest-storage-example. @bymax-one/nest-storage ships `./shared` as a zero-dependency
subpath (types + constants). The web app must consume ONLY that subpath, declaring none of the
library's NestJS/AWS-SDK peers: their absence is the proof.

CURRENT PHASE: 1, Task 1.4 of 5 (MIDDLE).

PRECONDITIONS
- Task 1.1 done on branch feat/phase-01-minio-stack-library-link; sibling library built.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §8.2 (Subpath usage), §4.2 (shared inventory)
- ../nest-storage/dist/shared/index.d.ts export names (adjust probe to what actually ships)

TASK
Create the apps/web package stub (library link only, no peers) and the shared-only probe.

DELIVERABLES
1. `apps/web/package.json`: name `@nest-storage-example/web`, private, the library file: link under
   dependencies, NO @nestjs/* and NO @aws-sdk/* entries, a `typecheck` script.
2. `apps/web/tsconfig.json` extending the base (no decorators needed).
3. `apps/web/lib/storage-shared-probe.ts`: imports exclusively from
   '@bymax-one/nest-storage/shared' (STORAGE_ERROR_CODES, DEFAULT_IMAGE_MIME_WHITELIST,
   DEFAULT_SIGNED_URL_TTL_SECONDS, type UploadResult), references each, JSDoc explaining the
   zero-dep proof. Never import '@bymax-one/nest-storage' (bare) in this app.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- TS strict; timeless comments; English only.
- Conventional Commit: `feat(web): consume nest-storage shared subpath with zero-dep probe (1.4)`.

Verification:
- `grep -rn "from '@bymax-one/nest-storage'" apps/web/` returns nothing (only the /shared form exists).
- `node -e "const d=require('./apps/web/package.json').dependencies||{}; ['@nestjs/common','@aws-sdk/client-s3'].forEach(p=>{if(d[p])throw new Error('web must NOT declare '+p)})"` exits 0.
- `pnpm --filter @nest-storage-example/web exec tsc --noEmit` exits 0.

Completion Protocol:
1. Set this task's Status to ✅ in its block and in the Task index.
2. Tick all acceptance criteria checkboxes.
3. Increment the header Progress counter (n/5).
4. Update the P1 row in docs/DEVELOPMENT_PLAN.md §1 and mirror in docs/tasks/README.md.
5. Append to the Completion log: `- 1.4 ✅ YYYY-MM-DD: <summary>`.
6. Commit with the Conventional message above.
```

---

### Task 1.5: Phase close

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 1.1-1.4

#### Description

Audit the phase Definition of Done, sync dashboards, open the PR with a GitHub Copilot review,
address findings, merge with CI green.

#### Acceptance criteria

- [ ] Plan P1 Definition of Done verified: `pnpm infra:up` healthy with 3 buckets + versioning; `pnpm typecheck` resolves both subpaths in both apps; web declares no peers.
- [ ] Phase file, plan §1, and tasks/README.md all updated.
- [ ] PR + Copilot review + all findings addressed; `gh pr merge --squash --delete-branch` with CI green.

#### Files to create / modify

- `docs/tasks/phase-01-minio-stack-library-link.md`, `docs/DEVELOPMENT_PLAN.md`, `docs/tasks/README.md`

#### Agent prompt

```
You are a senior release engineer closing a development phase.

PROJECT: nest-storage-example. Repo: github.com/bymaxone/nest-storage-example.

CURRENT PHASE: 1, Task 1.5 of 5 (LAST: phase close).

PRECONDITIONS
- Tasks 1.1-1.4 ✅ on branch feat/phase-01-minio-stack-library-link; CI green on the branch.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §5 (P1 Definition of Done) and §6 (Update Protocol)
- docs/tasks/README.md (Branch & PR workflow)

TASK
Audit the DoD, update all dashboards, open the phase PR, obtain and resolve the GitHub Copilot
review, merge clean, and hand off to P2.

DELIVERABLES
1. From a clean state: `pnpm install && pnpm infra:up && pnpm typecheck` all green; verify the
   three buckets and versioning as in Task 1.1 verification; `pnpm infra:down`.
2. Update this phase file (header ✅ on merge, index, log), docs/DEVELOPMENT_PLAN.md §1 (P1 row,
   counters, active phase -> P2), docs/tasks/README.md mirror.
3. `gh pr create --title "feat(infra): phase 1, minio stack and library consumption" --body <professional summary>`.
4. Request the GitHub Copilot code review (gh pr edit --add-reviewer copilot-pull-request-reviewer[bot]
   or the UI); address EVERY finding; re-request after substantive changes.
5. Merge with CI green: `gh pr merge --squash --delete-branch`; `git switch main && git pull`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with a failing check; no --no-verify.

Verification:
- `gh pr view --json state` shows MERGED; remote branch gone.
- docs/DEVELOPMENT_PLAN.md §1 shows P1 ✅ 5/5.

Completion Protocol:
1. Status ✅ in block + index; tick checkboxes; header Progress 5/5 and phase ✅.
2. Update plan §1 + README mirror.
3. Append `- 1.5 ✅ YYYY-MM-DD: phase merged in PR #<n>` to the Completion log.
4. Commit dashboards on main: `docs(plan): mark P1 complete`.
```

## Completion log

<!-- append lines: - N.M ✅ YYYY-MM-DD: summary -->

- 1.4 ✅ 2026-07-07: added apps/web package (@nest-storage-example/web) consuming only @bymax-one/nest-storage/shared with zero library peers, plus storage-shared-probe.ts importing STORAGE_ERROR_CODES, DEFAULT_IMAGE_MIME_WHITELIST, DEFAULT_SIGNED_URL_TTL_SECONDS and the UploadResult type; `tsc --noEmit` passes, no bare-server import present, and the peer-absence guard holds
- 1.3 ✅ 2026-07-07: added apps/api package (@nest-storage-example/api) consuming @bymax-one/nest-storage via file:../../../nest-storage plus the six peers, tsconfig extending the base with decorator metadata, and library-probe.ts importing from both `.` and `./shared`; `tsc --noEmit` passes and @aws-sdk/client-s3@3.1080.0 resolves to a single copy shared with the library peer
- 1.2 ✅ 2026-07-07: added apps/api/.env.example (all 21 §9.1 variables with dev defaults + comments) and apps/web/.env.example (NEXT_PUBLIC_API_URL); reconciled infra:up drift (one-shot exits under `--wait`, so it now waits on minio health then runs minio-setup to completion); verified up/down/nuke/logs
- 1.1 ✅ 2026-07-07: added docker-compose MinIO stack (loopback ports, curl liveness healthcheck, named volume) plus idempotent mc setup service creating vault/vault-archive/vault-versioned, enabling versioning, and seeding 10 objects across avatars/invoices/attachments; `up -d --wait` and re-run both exit 0
