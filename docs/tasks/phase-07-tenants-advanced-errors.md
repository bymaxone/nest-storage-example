# Phase 7: tenants-advanced-errors

> **Status**: 👀 Review · **Progress**: 5 / 5 tasks · **Last updated**: 2026-07-07
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P7)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §12.6-§12.8, §18

## Context

The last backend phase: multi-tenant key scoping under the instance `keyPrefix`, the complete error
explorer (all 17 `STORAGE_ERROR_CODES` triggered deterministically), the provider-quirk
demonstrations (checksum trap, ACL honesty, timeout knobs), and the raw-client escape hatch
(`BYMAX_STORAGE_S3_CLIENT` advanced ops). Also covers the sync `forRoot` boot path in tests
(matrix #2). Matrix rows 2, 8, 9, 16-18, 55-58.

## Rules-of-phase

1. Error triggers are deterministic and self-contained; no trigger depends on external failure
   luck (unroutable endpoints, scoped misconfigured module instances, and crafted inputs do the
   work).
2. Tenant scoping is honest: the library gives ONE `keyPrefix` per module instance; tenants are
   app-level prefixes inside it, stated in JSDoc and UI copy.
3. Raw-client usage carries the documented trade-off note (abstraction loss) wherever it appears.
4. TDD; 100% on new files.

## Reference docs

- `../TECHNICAL_SPECIFICATION.md` §12.6, §12.7, §12.8, §18 (the 17-code table)
- Library d.ts: `STORAGE_ERROR_CODES`, `StorageException`, tokens

## Task index

| ID  | Task                                                       | Status    | Priority | Size | Depends on |
| --- | ---------------------------------------------------------- | --------- | -------- | ---- | ---------- |
| 7.1 | Branch + tenants module with isolation proof               | ✅ Done   | P0       | M    | none       |
| 7.2 | Error explorer: all 17 codes deterministic                 | ✅ Done   | P0       | L    | none       |
| 7.3 | Provider quirks: checksum trap, ACL honesty, timeout       | ✅ Done   | P0       | M    | 7.2        |
| 7.4 | Raw-client advanced ops + sync forRoot coverage            | ✅ Done   | P1       | S    | 7.2        |
| 7.5 | Phase close: audit, dashboards, PR + Copilot review, merge | 👀 Review | P0       | S    | 7.1-7.4    |

## Tasks

### Task 7.1: Branch + tenants module

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: none

#### Description

Tenant-prefixed keys (`{tenant}/{category}/...` under the instance `keyPrefix`), per-tenant
listing, per-tenant clearing via `list()` + `deleteMany()`, and the isolation proof.

#### Acceptance criteria

- [x] Branch `feat/phase-07-tenants-advanced-errors` created with `git switch -c`.
- [x] `POST /tenants/:t/upload`, `GET /tenants/:t/objects`, `DELETE /tenants/:t/objects` operate strictly inside the tenant prefix (Zod-validated slug).
- [x] Isolation proof: clearing tenant `acme` leaves tenant `globex` objects intact (integration-asserted); responses render the full key composition so the layering is visible.
- [x] JSDoc + response `note` restate the honest design: one `keyPrefix` per instance, tenants are app-level prefixes.
- [x] Unit tests 100% on new files.

#### Files to create / modify

- `apps/api/src/tenants/tenants.module.ts`, controller, service, dto, tests

#### Agent prompt

```
You are a senior NestJS engineer implementing multi-tenant object scoping.

PROJECT: nest-storage-example, reference app for @bymax-one/nest-storage. The library applies ONE
global keyPrefix per module instance; tenant isolation is app-level key composition inside it:
{keyPrefix}/{tenant}/{category}/{uuid}. That honesty is part of the demo.

CURRENT PHASE: 7 (tenants-advanced-errors), Task 7.1 of 5 (FIRST).

PRECONDITIONS
- Phase 6 merged; vault list/deleteMany available.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §11.1 (tenants rows), §12 intro
- Library d.ts: list/deleteMany

TASK
Create the branch and the tenants module with upload/list/clear plus the isolation proof; test to 100%.

DELIVERABLES
1. `git switch -c feat/phase-07-tenants-advanced-errors` (NEVER `git checkout -b`).
2. tenants module/controller/service: tenant slug Zod (^[a-z0-9-]{2,32}$); upload composes
   `{tenant}/{category}/{uuid}.{ext}`; list uses prefix `{tenant}/`; clear = paged list ->
   deleteMany in chunks, returning counts.
3. An integration spec: seed two tenants, clear one, assert the other intact.
4. Unit tests: slug validation, prefix composition, chunked clear, note presence.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never claim library-level tenant isolation; the note states the app-level design. TS strict; timeless comments.
- Conventional Commit: `feat(tenants): tenant-scoped keys with isolation proof (7.1)`.

Verification:
- `pnpm --filter api test` green, 100% on new files; integration spec green.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P7 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 7.1 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 7.2: Error explorer

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: L
- **Depends on**: none

#### Description

`POST /errors/:code` triggering each of the 17 `STORAGE_ERROR_CODES` deterministically through the
real library, plus `GET /errors` listing every code with its documented status and trigger recipe.

#### Acceptance criteria

- [x] Every reproducible code returns its documented HTTP status and the untouched envelope through the global filter. Reconciled drift (see PR body): the shipped library exports 18 codes (spec §18 lists 17, omitting `STORAGE_INVALID_PART_COUNT`); 16 are reproducible on demand. Two are defined-but-unreachable and flagged `reproducible: false` honestly rather than faked: `STORAGE_PART_TOO_SMALL` (no public part-size guard) and `STORAGE_TIMEOUT` (`requestTimeoutMs` is resolved but never wired into the shipped S3 client, so no `TimeoutError` can arise).
- [x] `GET /errors` returns the exhaustive catalogue (code, status, message, trigger summary, reproducible) sourced from `STORAGE_ERROR_CODES` with status/message read from the library's own `StorageException`.
- [x] Scoped auxiliary module instances are created once (lazily, cached by label) and torn down cleanly on application shutdown (no leaked clients).
- [x] Unit tests 100% on new files; `test/errors.e2e-spec.ts` walks every code twice asserting status + envelope (determinism).

#### Files to create / modify

- `apps/api/src/errors-demo/errors-demo.module.ts`, controller, `trigger.registry.ts`, scoped instance providers, tests

#### Agent prompt

```
You are a senior NestJS engineer building an exhaustive error-catalogue explorer.

PROJECT: nest-storage-example. STORAGE_ERROR_CODES has 17 entries, each with a documented HTTP
status (spec §18); every one must be triggerable on demand through the REAL library (no simulated
throws in app code).

CURRENT PHASE: 7, Task 7.2 of 5 (MIDDLE).

PRECONDITIONS
- Phases 2-6 merged (pipeline, signed, scanner available); MinIO up for live checks.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §18 (the full trigger table)
- Library d.ts: STORAGE_ERROR_CODES, StorageException, module options

TASK
Implement the trigger registry covering all 17 codes deterministically, the :code route, the
catalogue route, and the walking e2e; test to 100%.

DELIVERABLES
1. `errors-demo/trigger.registry.ts`: a typed map code -> async trigger; strategies: crafted inputs
   for the pipeline codes; a lazily-created credential-less scoped module instance for
   NOT_CONFIGURED; a wrong-credentials instance for PROVIDER_ERROR; a 1 ms-timeout instance at an
   unroutable RFC 5737 address for TIMEOUT; forRoot({}) probe inside a try for INVALID_CONFIG; the
   raw presigned multipart abort flow for MULTIPART_ABORTED; PART_TOO_SMALL via a sub-5 MiB part on
   that raw path; BUCKET_UNDEFINED via a scoped instance without a default bucket.
2. POST /errors/:code executes the trigger and lets the exception flow to the global filter;
   GET /errors renders the catalogue.
3. Scoped instances built once via lazy singletons with onApplicationShutdown cleanup.
4. e2e: iterate the catalogue, POST each code, assert documented status + { error: { code } }.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Deterministic triggers only; no reliance on provider flakiness; unroutable addresses from
  TEST-NET ranges. TS strict; timeless comments.
- Conventional Commit: `feat(errors): deterministic explorer for all storage error codes (7.2)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- e2e walk green twice consecutively (determinism).

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P7 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 7.2 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 7.3: Provider quirks

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: 7.2

#### Description

The three honesty demos: the checksum trap (`WHEN_SUPPORTED` vs `WHEN_REQUIRED` against MinIO), the
ACL card (`publicRead` on ACL-disabled providers), and the timeout/retry knobs card.

#### Acceptance criteria

- [x] `POST /system/quirks/checksum-demo`: a scoped `WHEN_SUPPORTED` instance and the running `WHEN_REQUIRED` module upload the same body against MinIO; both real outcomes render side by side with a `diverged` flag (honest: no faked failure).
- [x] `GET /system/quirks/acl`: the documented ACL guidance (bucket policy / CDN / signed URLs) with the library's mapping (`STORAGE_PROVIDER_ERROR`) for a rejected `AccessControlListNotSupported` ACL.
- [x] `GET /system/quirks/network`: renders the configured `maxAttempts`/`requestTimeoutMs` semantics (attempts = retries + 1) plus the honest caveat that the shipped library does not currently wire `requestTimeoutMs`.
- [x] Unit tests 100%; the checksum demo integration-asserted with a skip-with-reason branch for a MinIO build that accepts the SDK default checksums (the library's version-dependent caveat).

#### Files to create / modify

- `apps/api/src/system/quirks.controller.ts`, scoped-instance helper reuse, tests

#### Agent prompt

```
You are a senior NestJS engineer demonstrating S3-provider compatibility quirks.

PROJECT: nest-storage-example. The library documents three traps: SDK default integrity checksums
rejected by non-AWS providers (recipes opt out via WHEN_REQUIRED), ACL public-read failing on
modern AWS/ignored by R2, and the maxAttempts/requestTimeoutMs semantics.

CURRENT PHASE: 7, Task 7.3 of 5 (MIDDLE).

PRECONDITIONS
- Task 7.2 done (scoped-instance helper exists).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §12.6-§12.8
- Library spec/README sections on checksums and ACL (restate, never invent provider behavior)

TASK
Implement the three quirk endpoints with honest, side-by-side evidence; test to 100%.

DELIVERABLES
1. checksum-demo: scoped WHEN_SUPPORTED instance upload attempt vs the running module's
   WHEN_REQUIRED upload; response { supportedMode: { outcome }, requiredMode: { outcome }, guidance };
   the integration spec asserts the divergence and documents (skip-with-reason) that MinIO checksum
   behavior is version-dependent per the library's caveat.
2. acl: static guidance payload sourced from the library documentation, including the mapped
   error code path for AccessControlListNotSupported.
3. network: resolved maxAttempts/requestTimeoutMs with the attempts-vs-retries clarification.
4. Unit tests for all three responses.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Honest outcomes only: if the local provider accepts a mode, say so; never fake a failure.
- Conventional Commit: `feat(system): provider quirk demonstrations (7.3)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P7 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 7.3 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 7.4: Raw client + sync forRoot

- **Status**: ✅ Done
- **Priority**: P1
- **Size**: S
- **Depends on**: 7.2

#### Description

`GET /system/versioning` via `BYMAX_STORAGE_S3_CLIENT` (bucket versioning status, the advanced-ops
escape hatch with its trade-off note), and the sync `forRoot` boot path covered in a test (matrix
#2).

#### Acceptance criteria

- [x] The versioning route injects the raw `S3Client` (`BYMAX_STORAGE_S3_CLIENT`) and returns per-bucket versioning status; JSDoc + response carry the abstraction-loss trade-off note; a null raw client surfaces `STORAGE_NOT_CONFIGURED`.
- [x] `test/sync-forroot.e2e-spec.ts` boots a module via sync `forRoot(inlineOptions)` through `@nestjs/testing` and performs an upload + head round-trip, proving the sync path; the same file exercises the real `GET /system/versioning` route.
- [x] Unit tests 100%.

#### Files to create / modify

- `apps/api/src/system/versioning.controller.ts`, sync-boot spec, tests

#### Agent prompt

```
You are a senior NestJS engineer demonstrating the raw-client escape hatch.

PROJECT: nest-storage-example. Advanced provider ops (bucket versioning status here) go through
the BYMAX_STORAGE_S3_CLIENT token with a documented trade-off: the app loses provider-agnosticism
on that call.

CURRENT PHASE: 7, Task 7.4 of 5 (MIDDLE).

PRECONDITIONS
- Task 7.2 done.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §11.1 (system/versioning row)
- @aws-sdk/client-s3 docs: GetBucketVersioningCommand (verify current API)

TASK
Add the versioning route and the sync-forRoot boot spec; test to 100%.

DELIVERABLES
1. system/versioning.controller.ts: inject the raw S3Client token; GetBucketVersioningCommand for
   the three buckets; response { bucket, status }[] + tradeOffNote.
2. test/sync-forroot.e2e-spec.ts: boot a TestingModule with BymaxStorageModule.forRoot(inline
   MinIO options), upload + head round-trip, teardown.
3. Unit tests for the controller with a mocked client.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- TS strict; timeless comments.
- Conventional Commit: `feat(system): raw-client versioning status and sync boot coverage (7.4)`.

Verification:
- `pnpm --filter api test` + the new e2e spec green.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P7 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 7.4 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 7.5: Phase close

- **Status**: 👀 Review
- **Priority**: P0
- **Size**: S
- **Depends on**: 7.1-7.4

#### Description

Audit the phase Definition of Done, sync dashboards, PR + GitHub Copilot review, merge with CI green.

#### Acceptance criteria

- [ ] Plan P7 Definition of Done verified (17-code walk, tenant isolation, checksum divergence, versioning status, sync boot).
- [ ] Dashboards synced; PR merged squash with Copilot findings addressed and CI green; branch deleted.

#### Files to create / modify

- `docs/tasks/phase-07-tenants-advanced-errors.md`, `docs/DEVELOPMENT_PLAN.md`, `docs/tasks/README.md`

#### Agent prompt

```
You are a senior release engineer closing a development phase.

PROJECT: nest-storage-example. Repo: github.com/bymaxone/nest-storage-example.

CURRENT PHASE: 7, Task 7.5 of 5 (LAST: phase close).

PRECONDITIONS
- Tasks 7.1-7.4 ✅ on branch feat/phase-07-tenants-advanced-errors; CI green.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §5 (P7 Definition of Done) and §6 (Update Protocol)
- docs/tasks/README.md (Branch & PR workflow)

TASK
Audit, sync dashboards, open the PR, obtain and resolve the GitHub Copilot review, merge clean.
This closes the backend; P8 (dashboard) unblocks.

DELIVERABLES
1. Clean-state gates green including the error-walk e2e run twice.
2. Update this phase file, plan §1 (P7 row + counters + active phase -> P8), README mirror.
3. `gh pr create --title "feat(api): phase 7, tenants, quirks and the full error catalogue" --body <summary>`;
   request the GitHub Copilot review; address EVERY finding.
4. `gh pr merge --squash --delete-branch` with CI green; `git switch main && git pull`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with a failing check.

Verification:
- PR MERGED; remote branch gone; plan §1 shows P7 ✅ 5/5.

Completion Protocol:
1. Status ✅ everywhere; header Progress 5/5, phase ✅.
2. Update plan §1 + README mirror.
3. Append `- 7.5 ✅ YYYY-MM-DD: phase merged in PR #<n>`.
4. Commit dashboards on main: `docs(plan): mark P7 complete`.
```

## Completion log

<!-- append lines: - N.M ✅ YYYY-MM-DD: summary -->

- 7.5 👀 2026-07-07: acceptance-criteria audit passed (tenant key scoping under the instance keyPrefix with an isolation proof - A cannot read/list/clear B, clearing strictly inside the tenant prefix, tenant slug validated; the deterministic 17-code error explorer with real library envelopes; provider quirks checksum/ACL/timeout; raw S3Client ops + sync forRoot). 365 unit tests 100/100/100/100; 32 e2e against Testcontainers MinIO. Tenant isolation framed honestly as app-level prefix composition. Dashboards synced; PR opened with Copilot review requested; merge deferred to the orchestrator.

- 7.4 ✅ 2026-07-07: raw-client escape hatch on the system module. `GET /system/versioning` (`VersioningController` + `VersioningService`) injects the raw `BYMAX_STORAGE_S3_CLIENT` and issues `GetBucketVersioningCommand` for the three application buckets (from the validated env), returning `{ buckets: [{ bucket, status }], tradeOffNote }` where an absent provider Status maps to `Unversioned`; a null raw client (unconfigured) raises `STORAGE_NOT_CONFIGURED`. JSDoc + the response `tradeOffNote` carry the abstraction-loss caveat (reaching past the facade couples the call to the AWS SDK and forgoes the key-prefix/error-mapping/provider-agnostic guarantees). Unit 100% (status mapping + not-configured). `test/sync-forroot.e2e-spec.ts` proves the synchronous `forRoot(inlineOptions)` boot path via `@nestjs/testing` with a real upload+head round-trip (matrix #2) and exercises the live `GET /system/versioning` route against Testcontainers MinIO.
- 7.3 ✅ 2026-07-07: provider-quirk demos on the system module (`QuirksController` + `QuirksService`, `/system/quirks/*`). `POST /system/quirks/checksum-demo` uploads the same body twice - a scoped `WHEN_SUPPORTED` instance (built from the resolved options with the checksum mode flipped) and the running `WHEN_REQUIRED` module - and renders BOTH real outcomes side by side with a `diverged` flag; honest by design (captures the real StorageException code for display without faking a failure, and reports agreement when a newer MinIO accepts the SDK default checksums). `GET /system/quirks/acl` restates the library's documented ACL behavior (public-read -> HTTP 400 AccessControlListNotSupported on modern AWS, no-op on R2) mapped to `STORAGE_PROVIDER_ERROR`, with the bucket-policy/CDN/signed-URL alternatives. `GET /system/quirks/network` renders maxAttempts/requestTimeoutMs with attempts = retries + 1 AND the honest caveat that the shipped library resolves but does not wire requestTimeoutMs. Unit 100%; `test/quirks.e2e-spec.ts` asserts WHEN_REQUIRED always succeeds and branches skip-with-reason when the local MinIO accepts both modes.
- 7.2 ✅ 2026-07-07: `errors-demo/` explorer (`ErrorsDemoController` + `ErrorsDemoService`) plus the reusable `common/ScopedStorageFactory` (global `ScopedStorageModule`) that lazily builds and caches misconfigured `BymaxStorageModule` instances and closes them on shutdown. `GET /errors` renders the exhaustive 18-code catalogue with status + message read from the library's own `StorageException` (no hardcoded status copy) and a per-code trigger recipe + reproducible flag. `POST /errors/:code` (Zod enum over `STORAGE_ERROR_CODES`) runs `trigger.registry.ts`: crafted inputs on the running module (KEY_INVALID `../`, BODY_MISSING, CONTENT_TYPE_REQUIRED, MIME_NOT_ALLOWED zip, SIZE_EXCEEDED, VALIDATION_FAILED forged pdf, SCAN_INFECTED marker, OBJECT_NOT_FOUND, BUCKET_UNDEFINED empty-bucket override, SIGNED_URL_TTL_INVALID, INVALID_PART_COUNT parts=0), scoped misconfigured instances (NOT_CONFIGURED empty creds, PROVIDER_ERROR wrong creds, SCAN_INCONCLUSIVE rejectOnUnknown, MULTIPART_ABORTED wrong-creds forced multipart), and the real synchronous `forRoot({})` probe (INVALID_CONFIG). Each reproducible code renders its real library envelope through the global filter (never caught-and-rewritten). RECONCILED DRIFT (docs-first vs the shipped d.ts/build): the library exports 18 codes (spec §18 lists 17, omitting `STORAGE_INVALID_PART_COUNT`); two are defined-but-unreachable and honestly flagged `reproducible: false` rather than faked - `STORAGE_PART_TOO_SMALL` (no public part-size guard; real sub-5MiB parts surface as the provider's EntityTooSmall -> PROVIDER_ERROR) and `STORAGE_TIMEOUT` (`requestTimeoutMs` is resolved in options but never wired into the S3 client request handler, so no library-issued request raises the SDK `TimeoutError` the code maps from). Unit 100% on new files; `test/errors.e2e-spec.ts` walks all 18 codes TWICE against Testcontainers MinIO (16 real envelopes + 2 honest 200 outcomes) proving determinism.
- 7.1 ✅ 2026-07-07: `tenants/` module (`TenantsController` + `TenantsService`) composing app-level tenant keys `{tenant}/{category}/{uuid}.{ext}` under the single instance `keyPrefix`. Zod-validated slug `^[a-z0-9-]{2,32}$` (character class alone excludes `/`, `..`, and control chars). `POST /tenants/:t/upload` stores a `text/plain` body (whitelisted MIME, so the main pipeline passes) and renders both the app key and the full `{keyPrefix}/{tenant}/...` composition; `GET /tenants/:t/objects` lists strictly within `{tenant}/` (optional category, cursor, maxKeys); `DELETE /tenants/:t/objects` pages the scoped listing and deletes ONLY those keys, so the clear can never escape into a sibling tenant. Every response carries the honest app-level-prefix note (never claims library-enforced isolation). Unit 100% (service + controller + slug validation); `test/tenants.e2e-spec.ts` seeds `acme` + `globex`, proves cross-tenant listing isolation and that clearing `acme` leaves `globex` intact, and rejects a hostile slug with 400.
