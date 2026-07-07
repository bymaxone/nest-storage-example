# Phase 5: signed-urls-direct-upload

> **Status**: 🔄 In Progress · **Progress**: 3 / 5 tasks · **Last updated**: 2026-07-07
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P5)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §12.4, §12.5, §17

## Context

The presigned surface: GET links with response overrides and visible TTL clamping, PUT links with
the Content-Length-Range policy, presigned multipart (uploadId + part URLs + complete/abort), and
the honest boundary that signed PUT bypasses local validation, mitigated by the confirm pattern
(`head()` now; scanner verify joins in P6 through an explicit seam). Real-fetch integration tests
PUT/GET against MinIO with the issued URLs. Matrix rows 11, 40-46.

## Rules-of-phase

1. Signed URLs are never logged and never asserted verbatim in test snapshots (they are
   credentials); tests assert structure and behavior, not URL contents.
2. Every issued URL response carries `expiresAt` and `requiredHeaders`; clients must be shown
   exactly what to send.
3. The confirm step is mandatory in the documented flow; the demo never presents "PUT and done"
   as complete.
4. TDD; 100% on new files; real-fetch specs run in the e2e tier against the compose/container MinIO.

## Reference docs

- `../TECHNICAL_SPECIFICATION.md` §12.4, §12.5, §17
- Library d.ts: `SignedGetUrlOptions`, `SignedPutUrlOptions`, `SignedUrlResult`, `getMultipartUploadUrls`

## Task index

| ID  | Task                                                        | Status  | Priority | Size | Depends on |
| --- | ----------------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 5.1 | Branch + signed GET URLs: overrides, clamp, invalid TTL     | ✅ Done | P0       | M    | none       |
| 5.2 | Signed PUT + confirm pattern (head now, scanner seam)       | ✅ Done | P0       | M    | 5.1        |
| 5.3 | Presigned multipart: parts, complete, abort                 | ✅ Done | P0       | M    | 5.2        |
| 5.4 | Real-fetch e2e: PUT/GET/multipart round-trips against MinIO | 📋 ToDo | P0       | M    | 5.3        |
| 5.5 | Phase close: audit, dashboards, PR + Copilot review, merge  | 📋 ToDo | P0       | S    | 5.1-5.4    |

## Tasks

### Task 5.1: Signed GET URLs

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: none

#### Description

`POST /signed/download-url`: response content-type/disposition overrides, the silent TTL clamp
rendered as requested-vs-effective, and the `ttlSeconds ≤ 0` rejection.

#### Acceptance criteria

- [x] Branch `feat/phase-05-signed-urls-direct-upload` created with `git switch -c`.
- [x] Response: `{ url, method: 'GET', expiresAt, requiredHeaders, requestedTtlSeconds, effectiveTtlSeconds }` where effective reflects the clamp against the configured 1 h cap.
- [x] `responseContentDisposition` (attachment filename) and `responseContentType` pass through.
- [x] `ttlSeconds: 0` → `STORAGE_SIGNED_URL_TTL_INVALID` envelope via the filter.
- [x] Unit tests 100% (clamp math, overrides, rejection).

#### Files to create / modify

- `apps/api/src/signed/signed.module.ts`, `signed.controller.ts`, `signed.service.ts`, dto, tests

#### Agent prompt

```
You are a senior NestJS engineer implementing presigned download URLs.

PROJECT: nest-storage-example, reference app for @bymax-one/nest-storage. SignedUrlService
.getDownloadUrl() clamps a requested ttlSeconds above maxTtlSeconds silently (never an error) and
rejects only ttlSeconds <= 0 with STORAGE_SIGNED_URL_TTL_INVALID. The example's cap is 3600 s so
the clamp is visible.

CURRENT PHASE: 5 (signed-urls-direct-upload), Task 5.1 of 5 (FIRST).

PRECONDITIONS
- Phase 4 merged; vault objects exist to sign against.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §12.4, §17
- Library d.ts: SignedGetUrlOptions, SignedUrlResult

TASK
Create the branch and the signed module with the download-url route making the clamp observable;
test to 100%.

DELIVERABLES
1. `git switch -c feat/phase-05-signed-urls-direct-upload` (NEVER `git checkout -b`).
2. signed module/controller/service; POST /signed/download-url (Zod: key, ttlSeconds?,
   responseContentDisposition?, responseContentType?); response includes requestedTtlSeconds and
   effectiveTtlSeconds derived from the returned expiresAt (rounded), never re-implementing the
   clamp in app code.
3. Unit tests: overrides pass-through, clamp visibility (mock returns capped expiresAt), zero/negative
   TTL propagates the library rejection.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never log or snapshot a full signed URL. TS strict; timeless comments.
- Conventional Commit: `feat(signed): download urls with visible ttl clamp (5.1)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- Live: requesting 86400 s returns effectiveTtlSeconds 3600; ttlSeconds 0 returns the invalid-ttl envelope.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P5 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 5.1 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 5.2: Signed PUT + confirm

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 5.1

#### Description

`POST /signed/upload-url` (contentType signature, `maxSizeBytes` length policy, `requiredHeaders`
echoed) and `POST /signed/confirm` implementing the post-direct-upload verification: `head()` size
and content-type check now, with an explicit, documented seam where the P6 scanner verify plugs in.

#### Acceptance criteria

- [x] Upload-url response: `{ url, method: 'PUT', expiresAt, requiredHeaders, key }` (plus `contentLengthRange` and the TTL view).
- [x] Confirm: `head()` the key, validate size ≤ policy and content-type match, register in the response; unknown key → 404 envelope; the scanner seam is a typed interface with a no-op default and a JSDoc pointer to its scanner-verify implementation.
- [x] The route pair documents the honest boundary: local validation did NOT run on the direct PUT.
- [x] Unit tests 100%.

#### Files to create / modify

- signed controller/service extensions, `signed/confirm.service.ts`, dto, tests

#### Agent prompt

```
You are a senior NestJS engineer implementing direct-upload issuance and verification.

PROJECT: nest-storage-example. getUploadUrl() signs contentType and applies a Content-Length-Range
policy via maxSizeBytes; bytes go browser -> provider directly, so LOCAL VALIDATION DOES NOT RUN:
the confirm step (head + scan) is the documented mitigation and this repo demonstrates it honestly.

CURRENT PHASE: 5, Task 5.2 of 5 (MIDDLE).

PRECONDITIONS
- Task 5.1 done on branch feat/phase-05-signed-urls-direct-upload.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §12.5, §17
- Library d.ts: SignedPutUrlOptions, SignedUrlResult.requiredHeaders

TASK
Add upload-url + confirm with the verification pattern and the explicit scanner seam; test to 100%.

DELIVERABLES
1. POST /signed/upload-url: Zod (category, contentType, maxSizeBytes? capped by env policy,
   ttlSeconds?); key composed like the uploads module; response echoes requiredHeaders verbatim.
2. `signed/confirm.service.ts`: IConfirmScanner interface (scan(key, bucket) -> verdict) bound to a
   Symbol token with a no-op default provider; confirm(key) = head() -> size/content-type policy
   check -> scanner verdict -> { confirmed, metadata, scan } or the structured refusal.
3. POST /signed/confirm: Zod { key }; wires the service; 404 envelope on unknown key.
4. Unit tests: issuance option mapping, confirm happy path, size violation refusal, content-type
   mismatch refusal, no-op scanner default, not-found propagation.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- The seam is a real DI token, not a TODO comment. TS strict; timeless comments.
- Conventional Commit: `feat(signed): upload urls with confirm verification pattern (5.2)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- Live: issue a PUT URL, PUT a small file with curl using the requiredHeaders, confirm returns
  confirmed:true with metadata.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P5 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 5.2 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 5.3: Presigned multipart

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 5.2

#### Description

`POST /signed/multipart-urls` driving `getMultipartUploadUrls()` (uploadId, per-part URLs,
completeUrl) plus the abort path so orphan parts are never billed.

#### Acceptance criteria

- [x] Response: `{ uploadId, partUrls: [{ partNumber, url }], completeUrl, expiresAt }` for the requested part count.
- [x] An abort route (`POST /signed/multipart-abort`) issues `AbortMultipartUpload` via the raw `BYMAX_STORAGE_S3_CLIENT` for an issued-but-unfinished uploadId; behavior documented as the raw-presigned-path responsibility.
- [x] Part count boundaries validated (1..1000 per Zod), parts below the 5 MiB S3 minimum documented in the response note.
- [x] Unit tests 100%.

#### Files to create / modify

- signed controller/service extensions, dto, tests

#### Agent prompt

```
You are a senior NestJS engineer implementing presigned multipart uploads.

PROJECT: nest-storage-example. getMultipartUploadUrls() returns uploadId + per-part URLs +
completeUrl; on this raw presigned path the CONSUMER orchestrates parts, so the abort
responsibility (avoiding billed orphan parts) belongs to the app and must be demonstrated.

CURRENT PHASE: 5, Task 5.3 of 5 (MIDDLE).

PRECONDITIONS
- Task 5.2 done.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §17 (multipart flow + abort)
- Library d.ts: getMultipartUploadUrls signature

TASK
Add multipart-urls issuance and the abort path; test to 100%.

DELIVERABLES
1. POST /signed/multipart-urls: Zod (category, contentType, parts 1..1000, ttlSeconds?); response
   as above plus a note on the S3 5 MiB minimum part size.
2. POST /signed/multipart-abort: Zod { key, uploadId }; aborts via the appropriate library/raw
   surface (verify against the shipped d.ts whether the library exposes an abort; if not, use the
   raw client token BYMAX_STORAGE_S3_CLIENT with AbortMultipartUploadCommand and document the
   escape hatch in JSDoc, mirroring the library's own guidance).
3. Unit tests: issuance shape, part-count boundaries, abort delegation.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never invent a library API: check the d.ts first, choose the documented path, note the choice in the PR body.
- TS strict; timeless comments.
- Conventional Commit: `feat(signed): presigned multipart with explicit abort path (5.3)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- Live: request 3 part URLs; abort; MinIO reports no in-progress multipart uploads for the key.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P5 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 5.3 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 5.4: Real-fetch e2e round-trips

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 5.3

#### Description

The e2e tier proof: browser-grade `fetch` against MinIO with issued URLs: signed GET (fresh +
expired), signed PUT (within + above the length policy), and a full presigned-multipart
split/PUT/complete plus an aborted variant.

#### Acceptance criteria

- [ ] `test/signed.e2e-spec.ts` boots the app against MinIO (compose or Testcontainers) and performs every round-trip with plain `fetch`.
- [ ] Over-limit PUT rejected by the provider's length policy (assert the failure class, not the provider's exact message).
- [ ] Expired GET denied (short TTL + waited expiry or clock-skewed assertion strategy documented).
- [ ] Multipart complete yields a downloadable object; the aborted variant leaves no orphan parts.
- [ ] Suite green under the e2e config with bounded workers.

#### Files to create / modify

- `apps/api/test/signed.e2e-spec.ts`, e2e helpers

#### Agent prompt

```
You are a senior test engineer proving presigned flows end to end.

PROJECT: nest-storage-example. The issued URLs must work for a real client: plain fetch PUT/GET
against MinIO, multipart split/complete/abort, provider-enforced length policy and expiry.

CURRENT PHASE: 5, Task 5.4 of 5 (MIDDLE).

PRECONDITIONS
- Tasks 5.1-5.3 done; e2e toolchain (jest.e2e.config.ts + createApp helper) exists from earlier phases.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §17, §21 (testing strategy)
- The signed module's issued response shapes (read the source you are testing)

TASK
Write the real-fetch e2e suite for every presigned flow.

DELIVERABLES
1. `test/signed.e2e-spec.ts`: within-limit PUT succeeds then confirm passes; over-limit PUT fails
   at the provider; GET round-trip returns the bytes; 2 s TTL GET fails after expiry (single
   bounded wait, no polling loop); multipart 3-part flow completes and downloads; aborted flow
   leaves zero in-progress uploads (verified via the raw client or a list-multipart probe helper).
2. Helpers factored into test/helpers/ so P9 reuses them.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never print full signed URLs in test output; assert behavior, not URL strings.
- One MinIO at a time; bounded workers; specs independent and re-runnable.
- Conventional Commit: `test(signed): real-fetch e2e for get, put and multipart flows (5.4)`.

Verification:
- `pnpm --filter api test:e2e` green including this suite, repeatable twice in a row.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P5 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 5.4 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 5.5: Phase close

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 5.1-5.4

#### Description

Audit the phase Definition of Done, sync dashboards, PR + GitHub Copilot review, merge with CI green.

#### Acceptance criteria

- [ ] Plan P5 Definition of Done verified (clamped expiry, invalid TTL envelope, real-fetch PUT with requiredHeaders, length-policy rejection, multipart complete + clean abort).
- [ ] Dashboards synced; PR merged squash with Copilot findings addressed and CI green; branch deleted.

#### Files to create / modify

- `docs/tasks/phase-05-signed-urls-direct-upload.md`, `docs/DEVELOPMENT_PLAN.md`, `docs/tasks/README.md`

#### Agent prompt

```
You are a senior release engineer closing a development phase.

PROJECT: nest-storage-example. Repo: github.com/bymaxone/nest-storage-example.

CURRENT PHASE: 5, Task 5.5 of 5 (LAST: phase close).

PRECONDITIONS
- Tasks 5.1-5.4 ✅ on branch feat/phase-05-signed-urls-direct-upload; CI green.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §5 (P5 Definition of Done) and §6 (Update Protocol)
- docs/tasks/README.md (Branch & PR workflow)

TASK
Audit, sync dashboards, open the PR, obtain and resolve the GitHub Copilot review, merge clean.

DELIVERABLES
1. Clean-state gates green including `pnpm --filter api test:e2e` (signed suite).
2. Update this phase file, plan §1 (P5 row + counters + active phase -> P6), README mirror.
3. `gh pr create --title "feat(signed): phase 5, presigned surface with direct upload" --body <summary>`;
   request the GitHub Copilot review; address EVERY finding.
4. `gh pr merge --squash --delete-branch` with CI green; `git switch main && git pull`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with a failing check.

Verification:
- PR MERGED; remote branch gone; plan §1 shows P5 ✅ 5/5.

Completion Protocol:
1. Status ✅ everywhere; header Progress 5/5, phase ✅.
2. Update plan §1 + README mirror.
3. Append `- 5.5 ✅ YYYY-MM-DD: phase merged in PR #<n>`.
4. Commit dashboards on main: `docs(plan): mark P5 complete`.
```

## Completion log

<!-- append lines: - N.M ✅ YYYY-MM-DD: summary -->

- 5.3 ✅ 2026-07-07: `POST /signed/multipart-urls` (`multipartUrlsBodySchema`: category, contentType, `parts` 1..1000, optional `ttlSeconds`) driving `SignedUrlService.getMultipartUploadUrls` and returning `{ uploadId, key, partUrls, completeUrl, expiresAt, effectiveTtlSeconds, minPartSizeBytes, note }`. Drift reconciled: `MultipartUploadUrlsResult` has no `expiresAt`, so the effective expiry is read from the `X-Amz-Date`/`X-Amz-Expires` the library signed into the complete URL (never recomputing the clamp). `POST /signed/multipart-abort` (`multipartAbortBodySchema`: key + uploadId) aborts via the raw `BYMAX_STORAGE_S3_CLIENT` (`AbortMultipartUploadCommand`), mirroring the library key-prefix rule and rejecting traversal keys with `STORAGE_KEY_INVALID`; provider errors map to `STORAGE_PROVIDER_ERROR`. 100% coverage.
- 5.2 ✅ 2026-07-07: `POST /signed/upload-url` (`uploadUrlBodySchema`: category, `type/subtype` contentType, optional `maxSizeBytes`/`ttlSeconds`) issuing a presigned PUT that echoes `requiredHeaders` verbatim and carries an advisory `contentLengthRange` (lower of request and policy) plus a note that the mandatory confirm enforces it. `POST /signed/confirm` (`confirmBodySchema`: key) `head()`s the landed object, re-applies the size + MIME policy read from `BYMAX_STORAGE_OPTIONS`, and runs the `CONFIRM_SCANNER` seam (`IConfirmScanner` bound to `NoOpConfirmScanner`, verdict `skipped` until scanner-verify lands); unknown key → 404 via the library. Every response states local validation did not run on the direct PUT. 100% coverage.
- 5.1 ✅ 2026-07-07: `POST /signed/download-url` (`downloadUrlBodySchema`: shared `objectKeySchema`, integer `ttlSeconds` that forwards non-positive values to the library, printable-ASCII response overrides) issuing a presigned GET via `SignedUrlService.getDownloadUrl`. Response renders requested-vs-effective TTL with `clamped`/`maxTtlSeconds`; the effective TTL is derived from the library's returned `expiresAt`, never by recomputing the clamp. `ttlSeconds <= 0` propagates `STORAGE_SIGNED_URL_TTL_INVALID` via the filter. Signed module wired into `AppModule`. 100% coverage.
