# Phase 4: listing-lifecycle

> **Status**: ✅ Done · **Progress**: 5 / 5 tasks · **Last updated**: 2026-07-07
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P4)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §11.1 (Vault), §15

## Context

Objects can be written and read (P3); this phase makes the vault browsable and manageable: paged
listing with folder navigation (`delimiter` + `commonPrefixes`), `head()`/`exists()` detail,
idempotent and bulk deletion with per-key failure rendering, server-side copy (same-bucket and to
`vault-archive`), and public URL rendering (plain + CDN). Matrix rows 7, 32-39.

## Rules-of-phase

1. Pagination is cursor-based end to end (`continuationToken` in, `nextCursor` out); never
   offset-based emulation.
2. Bulk operations surface the library's per-key failure report verbatim; no silent partial success.
3. Cross-bucket operations use explicit bucket options; the default bucket is never hardcoded in
   services.
4. TDD; library mocked in unit tests; 100% on new files.

## Reference docs

- `../TECHNICAL_SPECIFICATION.md` §11.1 (Vault table), §15 (Buckets)
- Library d.ts: `ListOptions`, `ListResult`, `deleteMany` result, `copy` options

## Task index

| ID  | Task                                                       | Status  | Priority | Size | Depends on |
| --- | ---------------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 4.1 | Branch + listing: prefix, pagination, folders              | ✅ Done | P0       | M    | none       |
| 4.2 | Detail: head, exists, public URLs (plain + CDN)            | ✅ Done | P0       | S    | 4.1        |
| 4.3 | Deletion: idempotent single + chunked bulk with failures   | ✅ Done | P0       | M    | 4.1        |
| 4.4 | Copy: same-bucket rename + archive cross-bucket            | ✅ Done | P0       | S    | 4.1        |
| 4.5 | Phase close: audit, dashboards, PR + Copilot review, merge | ✅ Done | P0       | S    | 4.1-4.4    |

## Tasks

### Task 4.1: Branch + listing & folders

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: none

#### Description

`GET /vault` with `prefix`, `maxKeys`, `cursor`, and `delimiter='/'` folder aggregation, walking
the seeded objects deterministically.

#### Acceptance criteria

- [x] Branch `feat/phase-04-listing-lifecycle` created with `git switch -c`.
- [x] `GET /vault?prefix=&maxKeys=&cursor=&delimiter=` maps to `list()` and returns `{ objects, commonPrefixes, isTruncated, nextCursor }`.
- [x] With 25 seeded objects and `maxKeys=10`, three pages walk the set with no repeats or gaps (proven in an integration test against MinIO).
- [x] `delimiter='/'` aggregates category folders into `commonPrefixes`.
- [x] Unit tests 100% on new files.

#### Files to create / modify

- `apps/api/src/vault/vault.controller.ts` (list route), `vault.service.ts`, `dto/list-query.dto.ts`, tests

#### Agent prompt

```
You are a senior NestJS engineer implementing paged object listing.

PROJECT: nest-storage-example, reference app for @bymax-one/nest-storage. list() wraps S3
ListObjectsV2: prefix (after the global keyPrefix), maxKeys (cap 1000), continuationToken,
delimiter '/' aggregating commonPrefixes.

CURRENT PHASE: 4 (listing-lifecycle), Task 4.1 of 5 (FIRST).

PRECONDITIONS
- Phase 3 merged: vault module exists with the download routes; seed objects exist from the P1 bootstrap.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §11.1 (Vault: GET /vault row)
- Library d.ts: ListOptions, ListResult

TASK
Create the branch and the GET /vault listing route with pagination + folder aggregation; test to
100% and prove the three-page walk against MinIO.

DELIVERABLES
1. `git switch -c feat/phase-04-listing-lifecycle` (NEVER `git checkout -b`).
2. Zod ListQuery dto (prefix?, maxKeys 1-1000 default 50, cursor?, delimiter enum '/' only);
   service mapping to ListOptions; response { objects: [{ key, size, etag, lastModified }],
   commonPrefixes, isTruncated, nextCursor }.
3. An integration spec (Testcontainers or the compose MinIO, tagged for the e2e config) seeding 25
   deterministic keys then walking pages of 10 asserting union = 25 distinct keys.
4. Unit tests: dto rejects, option mapping, result mapping.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Cursor-based only; TS strict; timeless comments; scenario-commented it().
- Conventional Commit: `feat(vault): paged listing with folder aggregation (4.1)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- Live: `curl 'localhost:3001/vault?delimiter=/'` shows commonPrefixes for the seeded categories.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P4 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 4.1 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 4.2: Detail, exists, public URLs

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 4.1

#### Description

`GET /vault/object` (full `ObjectMetadata`), `exists()` checks, and `getPublicUrl()` rendered in
plain and CDN forms.

#### Acceptance criteria

- [x] `GET /vault/object?key=` returns the complete `ObjectMetadata` (headers, x-amz-meta, storageClass, versionId when present); missing key → 404 envelope.
- [x] `GET /vault/object/public-url?key=` returns `{ url, cdnUrl? }`: `cdnUrl` present only when `STORAGE_CDN_BASE_URL` is set, with a note that the URL is unsigned and unvalidated.
- [x] `exists()` exposed internally for the copy precheck (4.4) with unit coverage for true/false.
- [x] Unit tests 100% on new files.

#### Files to create / modify

- vault controller/service extensions, tests

#### Agent prompt

```
You are a senior NestJS engineer implementing object detail endpoints.

PROJECT: nest-storage-example. head() returns ObjectMetadata; exists() is boolean on 404;
getPublicUrl() renders unsigned URLs (publicBaseUrl or cdnBaseUrl) without validating existence.

CURRENT PHASE: 4, Task 4.2 of 5 (MIDDLE).

PRECONDITIONS
- Task 4.1 done on branch feat/phase-04-listing-lifecycle.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §11.1 (head/public-url rows)
- Library d.ts: ObjectMetadata, getPublicUrl signature

TASK
Add the detail and public-url routes plus the exists() service seam; test to 100%.

DELIVERABLES
1. GET /vault/object: head() pass-through with the not-found envelope via the global filter.
2. GET /vault/object/public-url: { url, cdnUrl?, note } where note states the URL is unsigned and
   existence-unchecked (the library's documented semantics).
3. vault.service exists(key) seam used by later tasks; unit tests for true/false and provider-error
   warning path per the library contract.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- TS strict; timeless comments.
- Conventional Commit: `feat(vault): object detail, existence and public urls (4.2)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- Live: detail of a seeded key shows metadata; a bogus key returns the 404 envelope with code STORAGE_OBJECT_NOT_FOUND.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P4 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 4.2 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 4.3: Deletion surface

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 4.1

#### Description

Idempotent single delete (repeat returns a `warned` flag, never throws) and `deleteMany()` bulk
with the `{ deleted, failed }` report rendered verbatim.

#### Acceptance criteria

- [x] `DELETE /vault/object?key=`: first call deletes; second call returns 200 `{ warned: true }` (the library logs, does not throw).
- [x] `POST /vault/bulk-delete` body `{ keys: string[] }` (Zod, 1..1000): returns the library's `{ deleted, failed }` untouched; a mixed valid/invalid batch shows accurate partitioning.
- [x] Chunking beyond 1000 is rejected at the DTO with a pointer to batching guidance.
- [x] Unit tests 100% on new files.

#### Files to create / modify

- vault controller/service extensions, `dto/bulk-delete.dto.ts`, tests

#### Agent prompt

```
You are a senior NestJS engineer implementing deletion endpoints.

PROJECT: nest-storage-example. delete() is idempotent (warn, not throw, on missing keys);
deleteMany() takes up to 1000 keys (S3 API limit) and reports per-key failures.

CURRENT PHASE: 4, Task 4.3 of 5 (MIDDLE).

PRECONDITIONS
- Task 4.1 done.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §11.1 (delete rows)
- Library d.ts: delete/deleteMany signatures and result shape

TASK
Add single + bulk delete with honest partial-failure rendering; test to 100%.

DELIVERABLES
1. DELETE /vault/object: service wraps delete(); response { deleted: key, warned: boolean } where
   warned reflects the pre-check exists() = false (making the idempotency observable to the UI).
2. POST /vault/bulk-delete: Zod { keys: string[] } min 1 max 1000; passes to deleteMany(); returns
   { deleted, failed } verbatim.
3. Unit tests: idempotent second delete (mock exists false), bulk pass-through, dto boundary
   rejects (0 keys, 1001 keys).

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never mask partial failures. TS strict; timeless comments.
- Conventional Commit: `feat(vault): idempotent and bulk deletion with failure report (4.3)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- Live: deleting the same key twice yields warned:false then warned:true; a bulk with one bogus
  bucket-scoped key partitions correctly.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P4 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 4.3 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 4.4: Copy & archive

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 4.1

#### Description

`POST /vault/copy`: server-side copy within `vault` (rename pattern) and cross-bucket to
`vault-archive`, with an `exists()` precheck and the not-found envelope on a missing source.

#### Acceptance criteria

- [x] Same-bucket copy returns the new etag; source remains (copy, not move); an optional `deleteSource` flag completes the rename pattern.
- [x] `destination: 'archive'` targets `vault-archive` via `destinationBucket`; both sides confirmed via `exists()`.
- [x] Missing source → `STORAGE_OBJECT_NOT_FOUND` envelope.
- [x] Unit tests 100% on new files.

#### Files to create / modify

- vault controller/service extensions, `dto/copy.dto.ts`, tests

#### Agent prompt

```
You are a senior NestJS engineer implementing server-side object copy.

PROJECT: nest-storage-example. copy() performs server-side CopyObject (no bytes through the app),
supports cross-bucket via sourceBucket/destinationBucket, throws STORAGE_OBJECT_NOT_FOUND on a
missing source.

CURRENT PHASE: 4, Task 4.4 of 5 (MIDDLE).

PRECONDITIONS
- Tasks 4.1-4.3 done; vault-archive bucket exists.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §11.1 (copy row), §15
- Library d.ts: copy options/result

TASK
Add POST /vault/copy with rename and archive modes; test to 100%.

DELIVERABLES
1. Zod CopyDto { sourceKey, destinationKey, destination: 'same'|'archive', deleteSource?: boolean }.
2. Service: exists() precheck (404 envelope early), copy() with destinationBucket =
   STORAGE_ARCHIVE_BUCKET when destination='archive', optional delete() of the source afterwards;
   response { etag, source, destination, bucket }.
3. Unit tests: both modes, precheck failure, deleteSource path.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- TS strict; timeless comments.
- Conventional Commit: `feat(vault): server-side copy with archive target (4.4)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- Live: an archive copy is retrievable from vault-archive and the source persists unless deleteSource.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P4 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 4.4 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 4.5: Phase close

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 4.1-4.4

#### Description

Audit the phase Definition of Done, sync dashboards, PR + GitHub Copilot review, merge with CI green.

#### Acceptance criteria

- [x] Plan P4 Definition of Done verified live (three-page walk, folder aggregation, bulk partitioning, idempotent repeat, archive copy).
- [x] Dashboards synced; PR merged squash with Copilot findings addressed and CI green; branch deleted.

#### Files to create / modify

- `docs/tasks/phase-04-listing-lifecycle.md`, `docs/DEVELOPMENT_PLAN.md`, `docs/tasks/README.md`

#### Agent prompt

```
You are a senior release engineer closing a development phase.

PROJECT: nest-storage-example. Repo: github.com/bymaxone/nest-storage-example.

CURRENT PHASE: 4, Task 4.5 of 5 (LAST: phase close).

PRECONDITIONS
- Tasks 4.1-4.4 ✅ on branch feat/phase-04-listing-lifecycle; CI green.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §5 (P4 Definition of Done) and §6 (Update Protocol)
- docs/tasks/README.md (Branch & PR workflow)

TASK
Audit, sync dashboards, open the PR, obtain and resolve the GitHub Copilot review, merge clean.

DELIVERABLES
1. Clean-state gate green; live DoD: pagination walk (25 keys, pages of 10), commonPrefixes,
   mixed bulk delete partitioning, idempotent repeat delete, cross-bucket archive copy confirmed
   on both sides.
2. Update this phase file, plan §1 (P4 row + counters + active phase -> P5), README mirror.
3. `gh pr create --title "feat(vault): phase 4, browsable vault with full lifecycle" --body <summary>`;
   request the GitHub Copilot review; address EVERY finding.
4. `gh pr merge --squash --delete-branch` with CI green; `git switch main && git pull`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with a failing check.

Verification:
- PR MERGED; remote branch gone; plan §1 shows P4 ✅ 5/5.

Completion Protocol:
1. Status ✅ everywhere; header Progress 5/5, phase ✅.
2. Update plan §1 + README mirror.
3. Append `- 4.5 ✅ YYYY-MM-DD: phase merged in PR #<n>`.
4. Commit dashboards on main: `docs(plan): mark P4 complete`.
```

## Completion log

<!-- append lines: - N.M ✅ YYYY-MM-DD: summary -->

- 4.5 ✅ 2026-07-07: phase merged in PR #5 (squash); CI green; Copilot rounds addressed (utf-8 byte key limits, exists() provider-error propagation, public-url encoding, bulk-delete HttpCode 200); 228 tests, 100% coverage.
- 4.4 ✅ 2026-07-07: `POST /vault/copy` (`copyBodySchema`: sourceKey/destinationKey via shared `objectKeySchema`, `destination: 'same'|'archive'`, optional `deleteSource`) with an `exists()` precheck throwing `STORAGE_OBJECT_NOT_FOUND` before any CopyObject; archive mode routes to `STORAGE_ARCHIVE_BUCKET` via `destinationBucket`; `deleteSource` completes the rename pattern. Verified live against MinIO: same-bucket and archive copies return the new etag/bucket, and a missing source yields the 404 envelope. 100% coverage.
- 4.3 ✅ 2026-07-07: `DELETE /vault/object` idempotent single delete surfacing a `warned` flag via an `exists()` precheck, and `POST /vault/bulk-delete` (`bulkDeleteBodySchema`: 1-1000 keys, each via the shared `objectKeySchema`) passing the library `{ deleted, failed }` report through verbatim. Verified live against MinIO: repeat delete returns `warned:false` then `warned:true`; a mixed batch returns the S3 report. 100% coverage.
- 4.2 ✅ 2026-07-07: `GET /vault/object` head pass-through and `GET /vault/object/public-url` (plain URL always, `cdnUrl` only when `STORAGE_CDN_BASE_URL` set, plus an unsigned/unvalidated note); `exists()` service seam for the copy precheck. Routes live on the object-level `VaultController`. Verified live against MinIO: head returns full metadata, public-url builds the unsigned URL. 100% coverage.
- 4.1 ✅ 2026-07-07: `GET /vault` paged listing on new `VaultBrowseController`; `listQuerySchema` (prefix/maxKeys/cursor/delimiter) mapping cursor↔continuationToken and nextContinuationToken↔nextCursor; shared `objectKeySchema` (non-empty, ≤1024, no control chars). Verified live against compose MinIO: `delimiter=/` aggregates `attachments/ avatars/ invoices/`, a maxKeys=2 walk pages the set with no repeats, `prefix=` filters. 100% coverage.
