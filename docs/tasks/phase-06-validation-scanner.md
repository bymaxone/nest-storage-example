# Phase 6: validation-scanner

> **Status**: 🔄 In Progress · **Progress**: 0 / 5 tasks · **Last updated**: 2026-07-07
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P6)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §16

## Context

The pipeline classes exist since P2 (`PdfMagicByteValidator`, `MarkerFileScanner`, wired into the
module options). This phase builds the labs that make every stage observable and failable on
demand: MIME whitelist (with wildcard), size cap, magic-byte forgery, scanner verdicts across both
modes and both `rejectOnUnknown` values, plus wiring the real scanner verify into the P5 confirm
seam. Matrix rows 13, 14, 47-53.

## Rules-of-phase

1. Lab endpoints trigger real library pipeline stages; no simulated failures in app code.
2. Every failure renders the library envelope through the global filter; labs never catch and
   rewrite errors.
3. The infected fixture is the inert `X-DEMO-INFECTED` text marker; never real malware, never the
   EICAR binary.
4. TDD; 100% on new files.

## Reference docs

- `../TECHNICAL_SPECIFICATION.md` §16 (pipeline + marker table), §18 (codes 415/413/400/422)
- Library d.ts: `IUploadValidator`, `IFileScanner`, `FileScanResult`, validation options

## Task index

| ID  | Task                                                         | Status  | Priority | Size | Depends on |
| --- | ------------------------------------------------------------ | ------- | -------- | ---- | ---------- |
| 6.1 | Branch + validation lab: MIME wildcard + size cap paths      | 📋 ToDo | P0       | M    | none       |
| 6.2 | Magic-byte forgery demo (declared PDF, fake bytes)           | 📋 ToDo | P0       | S    | 6.1        |
| 6.3 | Scanner lab: verdicts, modes, rejectOnUnknown, removal proof | 📋 ToDo | P0       | M    | 6.1        |
| 6.4 | Confirm-scanner wiring + config introspection                | 📋 ToDo | P0       | S    | 6.3        |
| 6.5 | Phase close: audit, dashboards, PR + Copilot review, merge   | 📋 ToDo | P0       | S    | 6.1-6.4    |

## Tasks

### Task 6.1: Branch + validation lab (MIME + size)

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: none

#### Description

`POST /validation/upload` exercising the whitelist (exact, wildcard, rejected) and the size cap,
each failure rendered as its documented envelope, plus a `GET /validation/rules` endpoint rendering
the active whitelist and cap from the shared constants.

#### Acceptance criteria

- [ ] Branch `feat/phase-06-validation-scanner` created with `git switch -c`.
- [ ] `image/png` (whitelisted) passes; `video/mp4` passes via the `video/*` wildcard; `application/zip` → 415 `STORAGE_MIME_NOT_ALLOWED`.
- [ ] A body above `UPLOAD_MAX_SIZE_BYTES` → 413 `STORAGE_SIZE_EXCEEDED`.
- [ ] `GET /validation/rules` renders the exact whitelist + cap the module runs with (from the resolved options token, not re-declared).
- [ ] Unit tests 100% on new files.

#### Files to create / modify

- `apps/api/src/validation-lab/validation-lab.module.ts`, controller, service, dto, tests

#### Agent prompt

```
You are a senior NestJS engineer building an upload-validation laboratory.

PROJECT: nest-storage-example, reference app for @bymax-one/nest-storage. The library's
ValidationService runs MIME whitelist (wildcard-aware, case-insensitive), size cap, then custom
validators; failures throw StorageException with STORAGE_MIME_NOT_ALLOWED (415) or
STORAGE_SIZE_EXCEEDED (413).

CURRENT PHASE: 6 (validation-scanner), Task 6.1 of 5 (FIRST).

PRECONDITIONS
- Phase 5 merged; the module's validation block is configured (P2) with shared whitelists + 'video/*'.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §16, §18
- Library d.ts: validation options; shared DEFAULT_*_MIME_WHITELIST constants

TASK
Create the branch and the validation lab: an upload route whose failures are the real library
envelopes, and a rules introspection route; test to 100%.

DELIVERABLES
1. `git switch -c feat/phase-06-validation-scanner` (NEVER `git checkout -b`).
2. validation-lab module/controller/service: POST /validation/upload (multer memory; passes the
   file straight into StorageService.upload under `validation-lab/` keys; NO app-side prechecks,
   the library must be the one rejecting).
3. GET /validation/rules: reads the resolved options via BYMAX_STORAGE_OPTIONS and returns
   { mimeWhitelist, maxSizeBytes, customValidators: names } so the UI and the module can never
   disagree.
4. Unit tests: pass-through to upload, rules rendering; envelope propagation with a mocked
   StorageService throwing the two exceptions.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- The lab must not duplicate validation logic; the library is the system under test.
- TS strict; timeless comments; scenario-commented it().
- Conventional Commit: `feat(validation): validation lab with real pipeline failures (6.1)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- Live: zip -> 415 envelope; a generated 30 MiB body -> 413 envelope; png passes.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P6 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 6.1 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 6.2: Magic-byte forgery demo

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 6.1

#### Description

The custom-validator path: a text file declared as `application/pdf` is rejected by
`PdfMagicByteValidator` with the reason surfaced in `details`; a genuine `%PDF` body passes.

#### Acceptance criteria

- [ ] Forged PDF → 400 `STORAGE_VALIDATION_FAILED` with `details.reason` naming the magic-byte mismatch and `details.validator: 'pdf-magic-byte'` (or the library's documented detail shape).
- [ ] Genuine `%PDF-1.7` prefix body passes the same route.
- [ ] The lab response for the pass case includes which validators ran (from the rules endpoint data).
- [ ] Unit + integration coverage 100% on touched files.

#### Files to create / modify

- validation-lab controller/service extensions, fixtures builder, tests

#### Agent prompt

```
You are a senior NestJS engineer demonstrating content-sniffing validation.

PROJECT: nest-storage-example. PdfMagicByteValidator (implemented in P2) uses ctx.readBytes(4) and
rejects declared-PDF bodies whose first bytes are not '%PDF'; the library maps a validator
rejection to STORAGE_VALIDATION_FAILED (400) with the reason in details.

CURRENT PHASE: 6, Task 6.2 of 5 (MIDDLE).

PRECONDITIONS
- Task 6.1 done: the validation lab route exists and the validator is registered in the module options.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §16 (validator semantics)
- The P2 validator source (apps/api/src/validation-lab/pdf-magic-byte.validator.ts)

TASK
Extend the lab with the forgery path (fixtures generated inline) and prove both outcomes; test to 100%.

DELIVERABLES
1. In-code fixture helpers: forgedPdf() (text bytes, contentType application/pdf) and
   genuinePdf() ('%PDF-1.7\n...' minimal body).
2. Route behavior unchanged (same POST /validation/upload); an integration spec drives both
   fixtures through the real pipeline against MinIO asserting the 400 envelope detail shape and
   the successful UploadResult.
3. Unit tests for the fixture helpers and any service additions.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Assert the details shape the library actually emits (check its d.ts/source), never an invented one.
- Conventional Commit: `feat(validation): magic-byte forgery demonstration (6.2)`.

Verification:
- `pnpm --filter api test` green; integration spec green against MinIO.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P6 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 6.2 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 6.3: Scanner lab

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 6.1

#### Description

The scanner surface: marker-driven verdicts through the real pipeline, both modes (pre-upload
rejection vs post-upload removal with an `exists()` proof), and both `rejectOnUnknown` values.

#### Acceptance criteria

- [ ] `POST /scanner/upload` with an `X-DEMO-INFECTED` body → 422 `STORAGE_SCAN_INFECTED` with `details.threat: 'Demo.Marker.A'`; clean body passes.
- [ ] Post-upload mode (env or a scoped module instance, per the spec's honest design): the infected object is uploaded then removed, and the lab proves removal (`exists()` false) in the response.
- [ ] `X-DEMO-UNKNOWN`: passes with a `warning` field by default; 422 `STORAGE_SCAN_INCONCLUSIVE` when `rejectOnUnknown: true`.
- [ ] `GET /scanner/config` renders the active mode + rejectOnUnknown from the resolved options.
- [ ] Unit tests 100% on new files.

#### Files to create / modify

- `apps/api/src/scanner-lab/scanner-lab.module.ts`, controller, service, tests

#### Agent prompt

```
You are a senior NestJS engineer building a virus-scan-hook laboratory.

PROJECT: nest-storage-example. MarkerFileScanner (P2) returns deterministic verdicts from content
markers; the library rejects 'infected' (pre) or removes it (post) throwing STORAGE_SCAN_INFECTED,
and maps 'unknown' per rejectOnUnknown (STORAGE_SCAN_INCONCLUSIVE when true).

CURRENT PHASE: 6, Task 6.3 of 5 (MIDDLE).

PRECONDITIONS
- Task 6.1 done. The module-level scanner mode comes from env (SCANNER_MODE / SCANNER_REJECT_ON_UNKNOWN).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §16 (marker table + modes)
- Library d.ts: scanner options, error codes

TASK
Build the scanner lab making every verdict/mode combination observable; test to 100%.

DELIVERABLES
1. scanner-lab module/controller/service: POST /scanner/upload (text body via Zod, converted to a
   Buffer upload under `scanner-lab/` keys, through the real pipeline); GET /scanner/config
   (resolved options).
2. Mode coverage strategy: the running module uses the env mode; the OTHER mode is exercised in the
   integration spec by booting a second, test-scoped Nest module with forRoot({...scanner mode
   flipped}) so both behaviors are proven without pretending runtime mode switching exists (state
   this honestly in JSDoc; the library resolves mode at registration).
3. For post-upload infected: response includes { removed: true, existsAfter: false } backed by a
   real exists() call.
4. Unit + integration tests: all verdicts x both modes x both rejectOnUnknown values.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Inert markers only; no real malware patterns, no EICAR binary.
- TS strict; timeless comments.
- Conventional Commit: `feat(scanner): scanner lab with modes and removal proof (6.3)`.

Verification:
- `pnpm --filter api test` and the integration spec green against MinIO.
- Live: infected marker returns 422 with the threat name.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P6 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 6.3 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 6.4: Confirm-scanner wiring

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 6.3

#### Description

Replace the P5 confirm seam's no-op with a real implementation delegating to `MarkerFileScanner`,
closing the direct-upload verification loop.

#### Acceptance criteria

- [ ] The `IConfirmScanner` token now binds a scanner-backed provider; a direct-uploaded infected marker file is caught at confirm (refusal + removal) even though it bypassed local validation.
- [ ] The no-op provider remains available for tests and is the documented fallback when no scanner is configured.
- [ ] Unit tests 100%; the P5 e2e confirm spec extended with the infected path.

#### Files to create / modify

- `apps/api/src/signed/confirm.service.ts` provider wiring, scanner-backed implementation, tests

#### Agent prompt

```
You are a senior NestJS engineer closing a security verification loop.

PROJECT: nest-storage-example. Direct uploads bypass local validation (documented boundary); the
confirm step must now really scan: head() -> policy checks -> scanner verdict -> refuse + remove
on infected.

CURRENT PHASE: 6, Task 6.4 of 5 (MIDDLE).

PRECONDITIONS
- Task 6.3 done; the P5 IConfirmScanner Symbol token exists with a no-op default.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §12.5, §17 (the confirm flow)
- apps/api/src/signed/confirm.service.ts (the seam you are filling)

TASK
Bind a scanner-backed IConfirmScanner, refuse-and-remove infected direct uploads, and extend the
e2e confirm spec; test to 100%.

DELIVERABLES
1. A ScannerConfirm provider: downloads a bounded prefix (range) of the object, runs
   MarkerFileScanner in pre-upload shape, on infected deletes the object and returns the refusal
   verdict { confirmed: false, reason, threat }.
2. DI wiring: default binding switches to ScannerConfirm; the no-op stays exported for tests.
3. e2e: direct-PUT an X-DEMO-INFECTED body via a signed URL, confirm returns the refusal and
   exists() is false afterwards.
4. Unit tests: verdict mapping, removal call, clean path unchanged.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Bounded read only (never buffer a large object to scan a marker). TS strict; timeless comments.
- Conventional Commit: `feat(signed): scanner-backed confirm verification (6.4)`.

Verification:
- `pnpm --filter api test` + `test:e2e` green.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/5).
2. Update the P6 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 6.4 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 6.5: Phase close

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 6.1-6.4

#### Description

Audit the phase Definition of Done, sync dashboards, PR + GitHub Copilot review, merge with CI green.

#### Acceptance criteria

- [ ] Plan P6 Definition of Done verified (415/413/forged-PDF envelopes, infected 422 with threat, post-upload removal proof, unknown handling both ways, confirm catches direct-uploaded infected files).
- [ ] Dashboards synced; PR merged squash with Copilot findings addressed and CI green; branch deleted.

#### Files to create / modify

- `docs/tasks/phase-06-validation-scanner.md`, `docs/DEVELOPMENT_PLAN.md`, `docs/tasks/README.md`

#### Agent prompt

```
You are a senior release engineer closing a development phase.

PROJECT: nest-storage-example. Repo: github.com/bymaxone/nest-storage-example.

CURRENT PHASE: 6, Task 6.5 of 5 (LAST: phase close).

PRECONDITIONS
- Tasks 6.1-6.4 ✅ on branch feat/phase-06-validation-scanner; CI green.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §5 (P6 Definition of Done) and §6 (Update Protocol)
- docs/tasks/README.md (Branch & PR workflow)

TASK
Audit, sync dashboards, open the PR, obtain and resolve the GitHub Copilot review, merge clean.

DELIVERABLES
1. Clean-state gates green (unit + integration + e2e suites touched this phase).
2. Update this phase file, plan §1 (P6 row + counters + active phase -> P7), README mirror.
3. `gh pr create --title "feat(pipeline): phase 6, validation and scanner labs" --body <summary>`;
   request the GitHub Copilot review; address EVERY finding.
4. `gh pr merge --squash --delete-branch` with CI green; `git switch main && git pull`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with a failing check.

Verification:
- PR MERGED; remote branch gone; plan §1 shows P6 ✅ 5/5.

Completion Protocol:
1. Status ✅ everywhere; header Progress 5/5, phase ✅.
2. Update plan §1 + README mirror.
3. Append `- 6.5 ✅ YYYY-MM-DD: phase merged in PR #<n>`.
4. Commit dashboards on main: `docs(plan): mark P6 complete`.
```

## Completion log

<!-- append lines: - N.M ✅ YYYY-MM-DD: summary -->
