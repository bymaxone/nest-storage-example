# Phase 3: core-object-operations

> **Status**: 👀 Review · **Progress**: 5 / 5 tasks · **Last updated**: 2026-07-07
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P3)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §11.1, §12.1-§12.3

## Context

The wired skeleton (P2) can now grow the full object write/read path: every upload strategy the
library supports (single-shot, multipart, stream with known and unknown size, idempotent, SSE
override) with live progress snapshots, and every download shape (stream proxy, buffer preview,
byte range, versionId). Matrix rows 10, 12, 15, 20-31.

## Rules-of-phase

1. Every route follows the house style: Zod-validated input, thin controller, service owning the
   library call, typed response.
2. Upload strategy is never guessed in app code: the response surfaces the library's own
   `UploadResult.multipart` flag.
3. Progress is app-level state (in-memory session store) fed exclusively by the library's
   `onProgress` callback.
4. TDD per task; unit tests mock the library via its injection tokens; 100% on new files.

## Reference docs

- `../TECHNICAL_SPECIFICATION.md` §11.1 (uploads + vault download rows), §12.1-§12.3
- Library d.ts: `UploadOptions`, `UploadResult`, `DownloadOptions`, `ObjectMetadata`

## Task index

| ID  | Task                                                          | Status    | Priority | Size | Depends on |
| --- | ------------------------------------------------------------- | --------- | -------- | ---- | ---------- |
| 3.1 | Branch + uploads module: single-shot + headers + SSE override | ✅ Done   | P0       | M    | none       |
| 3.2 | Multipart + progress session store + stream strategies        | ✅ Done   | P0       | L    | 3.1        |
| 3.3 | Idempotent upload demo                                        | ✅ Done   | P0       | S    | 3.1        |
| 3.4 | Vault downloads: stream, buffer preview, range, versionId     | ✅ Done   | P0       | M    | 3.1        |
| 3.5 | Phase close: audit, dashboards, PR + Copilot review, merge    | 👀 Review | P0       | S    | 3.1-3.4    |

## Tasks

### Task 3.1: Branch + single-shot uploads

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: none

#### Description

The uploads module foundation: `POST /uploads/single` (multer memory storage → `upload()` with
Buffer), automatic-header round-trip, `x-amz-meta` metadata, and `POST /uploads/sse-override`
(per-call `AES256` / `'NONE'` sentinel).

#### Acceptance criteria

- [x] Branch `feat/phase-03-core-object-operations` created with `git switch -c`.
- [x] `POST /uploads/single` accepts a file + category, composes the key (`{category}/{uuid}.{ext}`), returns the full `UploadResult` (`multipart: false` for small files).
- [x] Custom `cacheControl`/`contentDisposition`/`metadata` accepted and observable via a follow-up `head()` in the integration test.
- [x] `POST /uploads/sse-override` demonstrates per-upload `serverSideEncryption` including the `'NONE'` sentinel.
- [x] Unit tests (library mocked via tokens) 100% on new files.

#### Files to create / modify

- `apps/api/src/uploads/uploads.module.ts`, `uploads.controller.ts`, `uploads.service.ts`, `dto/*.ts` (Zod), tests

#### Agent prompt

```
You are a senior NestJS engineer implementing file upload endpoints.

PROJECT: nest-storage-example, reference app for @bymax-one/nest-storage. NestJS 11, multer memory
storage, StorageService injected from the wired module.

CURRENT PHASE: 3 (core-object-operations), Task 3.1 of 5 (FIRST).

PRECONDITIONS
- Phase 2 merged: module wired, filter/pipe global, health green against MinIO.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §11.1 (Uploads table), §12.1
- Library d.ts: UploadOptions (headers, metadata, serverSideEncryption incl. 'NONE'), UploadResult

TASK
Create the branch and the uploads module with single-shot upload, header/metadata round-trip, and
the SSE-override route; unit-test to 100%.

DELIVERABLES
1. `git switch -c feat/phase-03-core-object-operations` (NEVER `git checkout -b`).
2. uploads module/controller/service; POST /uploads/single (FileInterceptor memory storage; Zod
   body: category enum avatars|invoices|attachments|media, optional cacheControl,
   contentDisposition, metadata record); key `{category}/{randomUUID()}.{ext}` (the library adds
   the global keyPrefix); returns UploadResult verbatim.
3. POST /uploads/sse-override: same upload with serverSideEncryption from body
   ('AES256'|'aws:kms'|'NONE'), demonstrating the per-call override and the omit-header sentinel.
4. Unit tests mocking StorageService: key composition, option pass-through (assert the exact
   UploadOptions given to the library), result pass-through, Zod rejects.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- TS strict, no any, no suppressions; thin controllers; @fileoverview + @layer; imperative JSDoc;
  timeless comments; every it() with a scenario comment; sequential bounded test runs.
- Conventional Commit: `feat(uploads): single-shot upload with headers and sse override (3.1)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- With MinIO up: a curl multipart-form upload returns multipart:false and a key under the category prefix.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P3 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 3.1 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 3.2: Multipart, progress, streams

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: L
- **Depends on**: 3.1

#### Description

The strategy showcase: threshold-crossing multipart with `onProgress` snapshots into an in-memory
session store (`GET /uploads/sessions/:id`), stream upload with known size, and unknown-size stream
forcing multipart.

#### Acceptance criteria

- [x] `POST /uploads/multipart`: a body ≥ threshold returns `multipart: true`; progress snapshots (`loaded`, `total`, `part`, `strategy`) are readable during and after the upload via the session route.
- [x] `POST /uploads/stream`: pipes the request stream to `upload()` with `size` from `Content-Length`; `?knownSize=false` omits `size` and the result proves multipart was forced.
- [x] Session store is bounded (LRU, documented cap) and pruned; no unbounded memory growth.
- [x] Unit tests simulate `onProgress` callbacks and assert snapshot sequences; 100% on new files.

#### Files to create / modify

- `apps/api/src/uploads/upload-session.store.ts`, controller/service extensions, tests

#### Agent prompt

```
You are a senior NestJS engineer implementing multipart and streaming uploads with live progress.

PROJECT: nest-storage-example. The library decides single-shot vs multipart from
multipart.thresholdBytes (5 MiB here) and emits onProgress events ({ loaded, total?, part? });
unknown-size streams force multipart.

CURRENT PHASE: 3, Task 3.2 of 5 (MIDDLE).

PRECONDITIONS
- Task 3.1 done: uploads module exists.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §10.3 (progress), §12.2
- Library d.ts: UploadOptions.onProgress, multipart options

TASK
Add multipart + stream routes with a bounded in-memory progress session store; test to 100%.

DELIVERABLES
1. `uploads/upload-session.store.ts`: create(id) -> session; append(id, snapshot); get(id);
   bounded LRU (cap 100, documented) with eviction; pure and fully unit-tested.
2. POST /uploads/multipart: multer memory upload of a large file; creates a session; passes
   onProgress writing { loaded, total, part, strategy: 'multipart'|'single' } snapshots; response
   includes sessionId + UploadResult.
3. GET /uploads/sessions/:id: snapshot list or 404.
4. POST /uploads/stream: consumes the raw request stream (Content-Type from header, size from
   Content-Length); query knownSize=false omits size (forces multipart); returns UploadResult +
   sessionId.
5. Unit tests: store behavior (append/evict/get), controller/service with a mocked StorageService
   whose upload() invokes onProgress in sequence; strategy flags asserted from the mocked results.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- No timers/polling loops server-side; the store is passive. TS strict; timeless comments.
- Conventional Commit: `feat(uploads): multipart and stream strategies with progress sessions (3.2)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- With MinIO up: uploading a generated 12 MiB file returns multipart:true and the session shows part-numbered snapshots.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P3 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 3.2 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 3.3: Idempotent upload demo

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 3.1

#### Description

`POST /uploads/idempotent`: same `idempotencyKey` twice returns the cached result with
`fromIdempotencyCache: true`, and the per-instance boundary is stated in the response copy.

#### Acceptance criteria

- [x] First call uploads (`fromIdempotencyCache: false`); an identical second call returns `fromIdempotencyCache: true` without a second provider write (asserted via mock call count in unit tests and via provider listing in the live check).
- [x] Response includes a `note` field restating the documented per-instance in-memory boundary.
- [x] Unit tests 100%.

#### Files to create / modify

- controller/service extensions, tests

#### Agent prompt

```
You are a senior NestJS engineer demonstrating idempotent uploads.

PROJECT: nest-storage-example. The library dedupes uploads by idempotencyKey in an in-memory LRU
(1000 entries, 24 h TTL), returning the prior UploadResult with fromIdempotencyCache: true. The
boundary is per-instance and must be stated, not hidden.

CURRENT PHASE: 3, Task 3.3 of 5 (MIDDLE).

PRECONDITIONS
- Task 3.1 done.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §12.3
- Library d.ts: UploadOptions.idempotencyKey, UploadResult.fromIdempotencyCache

TASK
Add POST /uploads/idempotent and its tests.

DELIVERABLES
1. POST /uploads/idempotent: Zod body { idempotencyKey: string, content: string, contentType };
   uploads a Buffer of content under `idempotent/{sha of key}.txt`; returns UploadResult plus a
   note field documenting the per-instance in-memory cache boundary.
2. Unit tests: mocked StorageService returning fromIdempotencyCache false then true; assert the
   service passes idempotencyKey through and the note is present.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- TS strict; timeless comments; scenario-commented it() blocks.
- Conventional Commit: `feat(uploads): idempotent upload demonstration (3.3)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- Live double-call shows fromIdempotencyCache flipping to true.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P3 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 3.3 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 3.4: Vault downloads

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 3.1

#### Description

The read side: stream proxy honoring metadata headers, size-guarded buffer preview, byte-range
download for the hex panel, and `versionId` download against the versioned bucket.

#### Acceptance criteria

- [x] `GET /vault/object/download?key=`: streams with `Content-Type`/`Content-Length`/`Content-Disposition` from `ObjectMetadata`; missing key → `STORAGE_OBJECT_NOT_FOUND` 404 through the filter.
- [x] `GET /vault/object/preview?key=`: `downloadBuffer()` guarded to ≤ 10 MiB (larger → 413-style structured refusal before calling the library).
- [x] `GET /vault/object/range?key=&start=&end=`: returns `{ base64, metadata }` for exactly the requested bytes.
- [x] `GET /vault/object/version?key=&versionId=`: retrieves a prior version from `vault-versioned` (two writes to the same key in the live check).
- [x] Unit tests 100% on new files.

#### Files to create / modify

- `apps/api/src/vault/vault.module.ts`, `vault.controller.ts`, `vault.service.ts`, dto, tests

#### Agent prompt

```
You are a senior NestJS engineer implementing storage read paths.

PROJECT: nest-storage-example. StorageService.download() returns { stream, metadata } (the v3
GetObject Body Readable); downloadBuffer() is for small objects; DownloadOptions supports range
('bytes=0-1023') and versionId.

CURRENT PHASE: 3, Task 3.4 of 5 (MIDDLE).

PRECONDITIONS
- Task 3.1 done (objects can be created); vault-versioned bucket exists with versioning on.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §11.1 (Vault download rows), §15
- Library d.ts: DownloadOptions, ObjectMetadata

TASK
Create the vault module's download surface (stream, preview, range, version) and test to 100%.

DELIVERABLES
1. vault module/controller/service with the four GET routes above; the stream route pipes to the
   response with headers set from metadata; the preview route head()s first and refuses > 10 MiB
   with a structured 413 body BEFORE downloading; the range route validates start<=end and builds
   'bytes=start-end'; the version route targets the versioned bucket via the bucket option.
2. Unit tests with mocked StorageService: header mapping, size guard, range string composition,
   versionId pass-through, not-found propagation (mock throws StorageException).

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- The library's stream must be piped, never buffered on the stream route. TS strict; timeless comments.
- Conventional Commit: `feat(vault): download surface with stream, preview, range and version (3.4)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- Live: range 0-15 of a seeded object returns 16 bytes decoded; two writes to the versioned bucket
  yield distinct versionIds and the older is retrievable.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P3 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 3.4 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 3.5: Phase close

- **Status**: 👀 Review
- **Priority**: P0
- **Size**: S
- **Depends on**: 3.1-3.4

#### Description

Audit the phase Definition of Done, sync dashboards, PR + GitHub Copilot review, merge with CI green.

#### Acceptance criteria

- [ ] Plan P3 Definition of Done verified live (strategy flags, forced multipart, idempotency flip, range/version reads).
- [ ] Dashboards synced (phase file, plan §1, README mirror).
- [ ] PR merged squash with Copilot findings addressed and CI green; branch deleted.

#### Files to create / modify

- `docs/tasks/phase-03-core-object-operations.md`, `docs/DEVELOPMENT_PLAN.md`, `docs/tasks/README.md`

#### Agent prompt

```
You are a senior release engineer closing a development phase.

PROJECT: nest-storage-example. Repo: github.com/bymaxone/nest-storage-example.

CURRENT PHASE: 3, Task 3.5 of 5 (LAST: phase close).

PRECONDITIONS
- Tasks 3.1-3.4 ✅ on branch feat/phase-03-core-object-operations; CI green.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §5 (P3 Definition of Done) and §6 (Update Protocol)
- docs/tasks/README.md (Branch & PR workflow)

TASK
Audit, sync dashboards, open the PR, obtain and resolve the GitHub Copilot review, merge clean.

DELIVERABLES
1. Clean-state gate green (`pnpm lint && pnpm typecheck && pnpm --filter api test`); live DoD checks
   with MinIO up: 1 MiB -> multipart:false, 12 MiB -> multipart:true with part snapshots,
   knownSize=false forces multipart, idempotency flips to cached, range returns exact bytes,
   versioned read returns the older version.
2. Update this phase file, plan §1 (P3 row + counters + active phase -> P4), README mirror.
3. `gh pr create --title "feat(api): phase 3, full upload and download surface" --body <summary>`;
   request the GitHub Copilot review; address EVERY finding.
4. `gh pr merge --squash --delete-branch` with CI green; `git switch main && git pull`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with a failing check.

Verification:
- PR MERGED; remote branch gone; plan §1 shows P3 ✅ 5/5.

Completion Protocol:
1. Status ✅ everywhere; header Progress 5/5, phase ✅.
2. Update plan §1 + README mirror.
3. Append `- 3.5 ✅ YYYY-MM-DD: phase merged in PR #<n>`.
4. Commit dashboards on main: `docs(plan): mark P3 complete`.
```

## Completion log

<!-- append lines: - N.M ✅ YYYY-MM-DD: summary -->

- 3.5 👀 2026-07-07: acceptance-criteria audit passed (all upload strategies + download shapes, multipart flag surfaced from UploadResult, progress fed by onProgress); 135 tests, 100% coverage; dashboards synced; PR #4 opened with Copilot review requested; awaiting CI green and merge.
- 3.4 ✅ 2026-07-07: Vault module with stream proxy, size-guarded buffer preview, byte-range, and versioned-bucket download; 100% coverage.
- 3.3 ✅ 2026-07-07: Idempotent upload route with SHA-256 key, per-instance cache boundary note, 100% coverage.
- 3.2 ✅ 2026-07-07: Multipart and stream upload strategies with bounded LRU progress session store (cap 100); 100% coverage.
- 3.1 ✅ 2026-07-07: Uploads module with single-shot, SSE-override, header/metadata pass-through; branch created; 100% coverage.
