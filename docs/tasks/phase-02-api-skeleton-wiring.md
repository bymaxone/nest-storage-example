# Phase 2: api-skeleton-wiring

> **Status**: 🔄 In Progress · **Progress**: 2 / 6 tasks · **Last updated**: 2026-07-07
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P2)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §9, §10, §18, §19

## Context

Infrastructure and consumption are proven (P0, P1). This phase boots the real NestJS 11 service:
Zod-validated environment, the canonical `BymaxStorageModule.forRootAsync` wiring
(`config/storage.config.ts`, the copy-paste artifact of spec §9.2), the global
`StorageExceptionFilter` and `ZodValidationPipe`, health, and the system introspection surface
(resolved config redacted, provider recipes). The validators and scanner referenced by the wiring
arrive in P6; this phase creates their classes as minimal, fully-tested implementations so the
wiring is honest from day one (the marker scanner and magic-byte validator are small and stable).

## Rules-of-phase

1. `config/storage.config.ts` must exercise every configuration block of spec §9.2 exactly; it is
   the artifact consumers copy.
2. No `process.env` access outside `config/env.schema.ts`.
3. Controllers are thin (Zod validate, delegate, return); services own library calls; every file
   carries `@fileoverview` + `@layer`; every export has imperative JSDoc.
4. TDD: each deliverable lands with its unit tests green in the same task.
5. Verify every NestJS 11 API against current official docs before use (never from memory).

## Reference docs

- `../TECHNICAL_SPECIFICATION.md` §9 (Configuration), §10 (Backend Design), §18 (Error Handling), §19 (Observability)
- Library README + type declarations in the linked checkout

## Task index

| ID  | Task                                                        | Status  | Priority | Size | Depends on |
| --- | ----------------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 2.1 | Branch + Nest app shell (`main.ts`, module, boot)           | ✅ Done | P0       | M    | none       |
| 2.2 | Zod env schema with aggregated fail-fast                    | ✅ Done | P0       | S    | 2.1        |
| 2.3 | Canonical wiring: `storage.config.ts` + validator + scanner | 📋 ToDo | P0       | M    | 2.2        |
| 2.4 | Cross-cutting: exception filter + validation pipe + health  | 📋 ToDo | P0       | M    | 2.3        |
| 2.5 | System module: config introspection + provider recipes      | 📋 ToDo | P1       | S    | 2.3        |
| 2.6 | Phase close: audit, dashboards, PR + Copilot review, merge  | 📋 ToDo | P0       | S    | 2.1-2.5    |

## Tasks

### Task 2.1: Branch + Nest app shell

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: M
- **Depends on**: none

#### Description

The bootable NestJS 11 application: `main.ts` (CORS to `WEB_ORIGIN`, shutdown hooks, port from
env), `app.module.ts`, `nest-cli.json`, Jest unit config with the 100% threshold and bounded
workers, and a boot smoke test via a `createApp()` seam.

#### Acceptance criteria

- [x] Branch `feat/phase-02-api-skeleton-wiring` created with `git switch -c`.
- [x] `apps/api` boots with `pnpm --filter api dev` (a temporary root `GET /` returns `{ name, version, docs }` until system lands).
- [x] `main.ts` delegates to an exported `createApp()` so e2e and unit tests cover bootstrap without spawning a process.
- [x] `jest.config.cjs` (+ `jest-e2e.config.mjs`): `coverageThreshold` 100/100/100/100, `maxWorkers: '50%'`; the boot smoke test passes.
- [x] `pnpm --filter api test` green; CI still green.

#### Files to create / modify

- `apps/api/nest-cli.json`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/app.controller.ts`, `apps/api/jest.config.ts`, `apps/api/jest.e2e.config.ts`, `apps/api/test/boot.e2e-spec.ts`

#### Agent prompt

```
You are a senior NestJS engineer.

PROJECT: nest-storage-example, reference app for @bymax-one/nest-storage. NestJS 11 on Node >= 24,
TypeScript 5.9 strict, Jest with a hard 100% coverage threshold.

CURRENT PHASE: 2 (api-skeleton-wiring), Task 2.1 of 6 (FIRST).

PRECONDITIONS
- Phases 0-1 merged: workspace, CI, MinIO stack, library linked with a passing dual-subpath probe.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §10 (Backend Design)
- NestJS 11 official docs: application bootstrap, enableShutdownHooks, CORS (verify current API)

TASK
Create the branch and the bootable Nest app shell with the test toolchain (100% threshold, bounded
workers) and a createApp() seam so bootstrap is testable.

DELIVERABLES
1. `git switch -c feat/phase-02-api-skeleton-wiring` (NEVER `git checkout -b`).
2. `apps/api/src/main.ts`: reads PORT/WEB_ORIGIN via the config layer (temporary direct env read is
   FORBIDDEN; if 2.2 has not landed, bootstrap with defaults and a documented seam), CORS,
   enableShutdownHooks, listen; delegates construction to `createApp()` exported from
   `src/app.factory.ts`.
3. `app.module.ts` + a minimal `app.controller.ts` (`GET /` -> { name, version, docs }).
4. `jest.config.ts`: ts-jest, rootDir src, coverageThreshold global 100/100/100/100,
   maxWorkers '50%', collectCoverageFrom excluding *.module.ts and main.ts (main covered by e2e).
   `jest.e2e.config.ts` stub pointing at test/.
5. `test/boot.e2e-spec.ts`: boots createApp(), asserts GET / 200 shape, closes cleanly.
6. Unit tests for the controller; every it() carries a scenario comment.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- TS strict, no any, no suppressions; functions <= 50 lines; files <= 800; @fileoverview + @layer
  header per file; imperative JSDoc on exports; timeless comments; English only.
- Test runs are sequential with bounded workers; never fan out test agents.
- Conventional Commit: `feat(api): bootable nest shell with tested createApp seam (2.1)`.

Verification:
- `pnpm --filter api test` green with 100% on the included files.
- `pnpm --filter api dev` boots and `curl -s localhost:3001/` returns the JSON shape.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/6).
2. Update the P2 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 2.1 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 2.2: Zod env schema

- **Status**: ✅ Done
- **Priority**: P0
- **Size**: S
- **Depends on**: 2.1

#### Description

`config/env.schema.ts`: every Appendix A variable Zod-validated once at boot, aggregated
fail-fast report that never echoes values, typed `Env` export consumed via `@nestjs/config`.

#### Acceptance criteria

- [x] Schema covers every spec §9.1 variable with correct types/coercions/defaults (booleans, numbers, enums for `SCANNER_MODE` and `STORAGE_CHECKSUM_MODE`).
- [x] Boot with an invalid env prints ONE aggregated report listing every violation by variable name (values never printed) and exits non-zero.
- [x] `main.ts`/`app.factory.ts` consume PORT/WEB_ORIGIN through the validated config only; the temporary seam from 2.1 is removed.
- [x] Unit tests cover happy path, each failure class, and the no-value-echo guarantee.

#### Files to create / modify

- `apps/api/src/config/env.schema.ts`, `apps/api/src/config/config.module.ts`, `apps/api/src/app.factory.ts` (env consumption), tests

#### Agent prompt

```
You are a senior NestJS engineer specializing in configuration safety.

PROJECT: nest-storage-example. All environment access flows through one Zod schema validated at
boot; the aggregated error report lists variable names and issues, never values (secrets must not
leak into logs).

CURRENT PHASE: 2, Task 2.2 of 6 (MIDDLE).

PRECONDITIONS
- Task 2.1 done on branch feat/phase-02-api-skeleton-wiring.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §9.1 (the variable registry)
- @nestjs/config official docs for the validate option; Zod 4 docs for coercion/enums (verify current APIs)

TASK
Implement the validated env layer and route all existing env consumption through it.

DELIVERABLES
1. `src/config/env.schema.ts`: the Zod object for every §9.1 variable (coerce numbers, boolean
   'true'/'false' handling, enums 'pre-upload'|'post-upload' and 'WHEN_SUPPORTED'|'WHEN_REQUIRED',
   sensible dev defaults where the registry defines them), `validateEnv(raw)` returning the typed
   Env or throwing one aggregated Error whose message lists each offending VARIABLE NAME + issue
   (never the received value), and the exported `Env` type.
2. `src/config/config.module.ts`: @nestjs/config forRoot({ isGlobal: true, validate: validateEnv }).
3. Rewire app.factory/main to consume PORT/WEB_ORIGIN via ConfigService; delete the 2.1 seam.
4. Unit tests: valid env passes; missing required, bad number, bad enum each reported; multiple
   violations aggregate into one report; assert the report does NOT contain a planted secret value.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- No process.env access outside env.schema.ts. TS strict, no any. Timeless comments.
- Conventional Commit: `feat(api): zod env schema with aggregated fail-fast report (2.2)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- `STORAGE_ENDPOINT= pnpm --filter api dev` exits non-zero printing one aggregated report.
- `grep -rn "process.env" apps/api/src --include='*.ts' | grep -v env.schema.ts` returns nothing.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/6).
2. Update the P2 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 2.2 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 2.3: Canonical wiring + pipeline classes

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 2.2

#### Description

`config/storage.config.ts` implementing spec §9.2 verbatim, the `PdfMagicByteValidator`, the
`MarkerFileScanner`, and the `BymaxStorageModule.forRootAsync` registration.

#### Acceptance criteria

- [ ] `buildStorageOptions(env)` matches spec §9.2: connection, keyPrefix, headers, signedUrls (reduced `maxTtlSeconds`), multipart, validation (shared whitelists + magic-byte validator), scanner (marker impl, env mode), checksum mode, network knobs.
- [ ] `PdfMagicByteValidator implements IUploadValidator` using `readBytes(4)`; `MarkerFileScanner implements IFileScanner` with the deterministic verdict table of spec §16.
- [ ] `app.module.ts` registers `BymaxStorageModule.forRootAsync` injecting the validated config.
- [ ] Boot against Docker MinIO succeeds; unit tests cover the factory mapping (every option asserted), both classes (all verdicts/paths), 100%.

#### Files to create / modify

- `apps/api/src/config/storage.config.ts`, `apps/api/src/validation-lab/pdf-magic-byte.validator.ts`, `apps/api/src/scanner-lab/marker-file.scanner.ts`, `apps/api/src/app.module.ts`, tests

#### Agent prompt

```
You are a senior NestJS engineer wiring a storage library the way production services should.

PROJECT: nest-storage-example. The canonical forRootAsync wiring (spec §9.2) is THE copy-paste
artifact of this repo: it must exercise every configuration block of @bymax-one/nest-storage.

CURRENT PHASE: 2, Task 2.3 of 6 (MIDDLE).

PRECONDITIONS
- Tasks 2.1-2.2 done; validated Env available via ConfigService; MinIO up for the boot check.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §9.2 (the wiring, reproduce faithfully), §16 (validator + scanner semantics)
- Library type declarations for BymaxStorageModuleOptions, IUploadValidator, IFileScanner (the truth)

TASK
Implement buildStorageOptions, the magic-byte validator, the marker scanner, and register the
module; unit-test everything to 100%.

DELIVERABLES
1. `src/config/storage.config.ts`: buildStorageOptions(env) exactly as spec §9.2 (conditional
   spreads for optional cdnBaseUrl/SSE; the reduced maxTtlSeconds; shared default whitelists +
   'video/*'; the validator + scanner instances; checksum mode from env).
2. `src/validation-lab/pdf-magic-byte.validator.ts`: name 'pdf-magic-byte'; passes non-PDF content
   types and absent readBytes; rejects declared-PDF whose first 4 bytes are not '%PDF' with a
   precise reason.
3. `src/scanner-lab/marker-file.scanner.ts`: engine 'marker-demo'; body containing X-DEMO-INFECTED
   -> infected with threat 'Demo.Marker.A'; X-DEMO-UNKNOWN -> unknown; otherwise clean; handles
   Buffer and Readable bodies (read up to a bounded prefix); post-upload mode receives only
   key/bucket, resolve verdict via a HEAD-less convention documented in JSDoc (key suffix marker),
   keeping determinism without downloading.
4. `app.module.ts`: BymaxStorageModule.forRootAsync({ imports: [ConfigModule], inject:
   [ConfigService], useFactory: (config) => buildStorageOptions(<typed env>) }).
5. Unit tests: factory maps every env knob (assert each option); validator all branches; scanner
   all verdicts and both body kinds; 100% on new files.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never invent library APIs: reconcile any §9.2 drift against the shipped d.ts and record it in the PR body.
- TS strict; functions <= 50 lines; @fileoverview + @layer; imperative JSDoc; timeless comments.
- Conventional Commit: `feat(api): canonical storage wiring with validator and scanner (2.3)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- `pnpm infra:up && pnpm --filter api dev` boots clean against MinIO (no unhandled rejection), then Ctrl-C shuts down gracefully.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/6).
2. Update the P2 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 2.3 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 2.4: Exception filter, validation pipe, health

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 2.3

#### Description

The cross-cutting HTTP layer: `StorageExceptionFilter` passing the library envelope through,
`ZodValidationPipe`, and `GET /health` backed by an `exists()` probe.

#### Acceptance criteria

- [ ] `@Catch(StorageException)` filter returns the library's `{ error: { code, message, details } }` body with its HTTP status untouched; unknown errors are not swallowed by it.
- [ ] `ZodValidationPipe` rejects with a structured 400 (`{ error: { code: 'VALIDATION', issues } }`) without echoing raw values.
- [ ] `GET /health`: `{ status: 'up', latencyMs, bucket }` via `exists()` on a sentinel key; degraded MinIO yields `{ status: 'down' }` 503.
- [ ] Both registered globally in `createApp()`; e2e boot spec extended to assert health against the container; unit tests 100%.

#### Files to create / modify

- `apps/api/src/common/storage-exception.filter.ts`, `apps/api/src/common/zod-validation.pipe.ts`, `apps/api/src/system/health.controller.ts`, `apps/api/src/system/system.module.ts`, `apps/api/src/app.factory.ts`, tests

#### Agent prompt

```
You are a senior NestJS engineer building cross-cutting HTTP infrastructure.

PROJECT: nest-storage-example. The library throws StorageException (an HttpException carrying
{ error: { code, message, details } }); this app passes that envelope through verbatim and adds a
Zod pipe and a health probe.

CURRENT PHASE: 2, Task 2.4 of 6 (MIDDLE).

PRECONDITIONS
- Task 2.3 done: the module is wired; StorageService is injectable.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §18 (Error Handling), §19 (Observability & Health)
- Library d.ts for StorageException/STORAGE_ERROR_CODES shape

TASK
Implement the filter, the pipe, and health; register globally; test to 100%.

DELIVERABLES
1. `common/storage-exception.filter.ts`: @Catch(StorageException); reply with
   exception.getStatus() + exception.getResponse() unchanged; JSDoc documents WHY pass-through
   (the library envelope is already the public contract).
2. `common/zod-validation.pipe.ts`: generic pipe taking a Zod schema; failure -> 400
   { error: { code: 'VALIDATION', issues: [{ path, message }] } }; never echoes received values.
3. `system/health.controller.ts` + `system.module.ts`: GET /health measuring an exists() probe on
   `<keyPrefix>/health/sentinel` with latency; catch provider failure -> 503 down.
4. Register filter + pipe globally in createApp(); extend test/boot.e2e-spec.ts to assert
   /health up against the compose MinIO.
5. Unit tests: filter (status + body pass-through, non-StorageException rethrow), pipe (pass,
   reject shape, no-echo), health (up, down via mocked StorageService token).

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Mock the library in unit tests via its injection tokens; real MinIO only in e2e.
- TS strict; timeless comments; imperative JSDoc.
- Conventional Commit: `feat(api): storage exception filter, zod pipe and health probe (2.4)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- With MinIO up: `curl -s localhost:3001/health` shows status up and a numeric latencyMs.
- With MinIO stopped: /health returns 503 down (manual spot-check, also covered in e2e later).

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/6).
2. Update the P2 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 2.4 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 2.5: System introspection + provider recipes

- **Status**: 📋 ToDo
- **Priority**: P1
- **Size**: S
- **Depends on**: 2.3

#### Description

`GET /system/config` (resolved options via `BYMAX_STORAGE_OPTIONS`, credentials redacted) and
`GET /system/recipes` rendering all six `providerRecipes` with quirk annotations.

#### Acceptance criteria

- [ ] `/system/config` returns the resolved options with `credentials.accessKeyId` masked to first 4 chars and `secretAccessKey` fully redacted; proves tokens injection (matrix #19).
- [ ] `/system/recipes` renders aws, digitalOceanSpaces, cloudflareR2, backblazeB2, minio, wasabi with sample args and per-provider quirk notes (checksums, ACL, publicBaseUrl) sourced from the library docs.
- [ ] Unit tests 100% (redaction proven: the secret never appears in the serialized response).

#### Files to create / modify

- `apps/api/src/system/system.controller.ts`, `apps/api/src/system/config-redactor.ts`, tests

#### Agent prompt

```
You are a senior NestJS engineer building operational introspection endpoints.

PROJECT: nest-storage-example. The system surface proves what the module actually runs with
(resolved options, redacted) and renders the library's providerRecipes with honest quirk notes.

CURRENT PHASE: 2, Task 2.5 of 6 (MIDDLE).

PRECONDITIONS
- Task 2.3 done: BYMAX_STORAGE_OPTIONS is injectable; providerRecipes importable.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §11.1 (system rows), §12.6-§12.7 (the quirks to annotate)
- Library d.ts for providerRecipes signatures

TASK
Implement /system/config (redacted resolved options) and /system/recipes (six recipes + quirks);
test to 100% including the redaction guarantee.

DELIVERABLES
1. `system/config-redactor.ts`: pure function cloning the options with accessKeyId masked
   (first 4 + asterisks) and secretAccessKey replaced by '[redacted]'; handles absent credentials.
2. `system/system.controller.ts`: GET /system/config (inject BYMAX_STORAGE_OPTIONS, return
   redacted), GET /system/recipes (build each recipe with representative sample args, attach
   { quirks: string[] } per provider: checksum WHEN_REQUIRED for non-AWS, ACL restrictions on
   AWS/R2, R2 publicBaseUrl requirement, MinIO path-style).
3. Unit tests: redaction (secret string planted in options never appears in JSON.stringify of the
   response), recipe rendering shape, every quirk list non-empty.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Quirk notes must restate the library's documented behavior; do not invent provider claims.
- TS strict; timeless comments.
- Conventional Commit: `feat(api): system config introspection and provider recipes (2.5)`.

Verification:
- `pnpm --filter api test` green, 100% on new files.
- `curl -s localhost:3001/system/config | grep -c minioadmin` prints 0 (never the raw secret).
- `curl -s localhost:3001/system/recipes` lists 6 providers.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/6).
2. Update the P2 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 2.5 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 2.6: Phase close

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 2.1-2.5

#### Description

Audit the phase Definition of Done, sync dashboards, open the PR with a GitHub Copilot review,
address findings, merge with CI green.

#### Acceptance criteria

- [ ] Plan P2 Definition of Done verified (boot against MinIO, health shape, redacted introspection, six recipes, aggregated env failure).
- [ ] Phase file, plan §1, tasks/README.md updated.
- [ ] PR + Copilot review, findings addressed, squash-merged with CI green, branch deleted.

#### Files to create / modify

- `docs/tasks/phase-02-api-skeleton-wiring.md`, `docs/DEVELOPMENT_PLAN.md`, `docs/tasks/README.md`

#### Agent prompt

```
You are a senior release engineer closing a development phase.

PROJECT: nest-storage-example. Repo: github.com/bymaxone/nest-storage-example.

CURRENT PHASE: 2, Task 2.6 of 6 (LAST: phase close).

PRECONDITIONS
- Tasks 2.1-2.5 ✅ on branch feat/phase-02-api-skeleton-wiring; CI green.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §5 (P2 Definition of Done) and §6 (Update Protocol)
- docs/tasks/README.md (Branch & PR workflow)

TASK
Audit the DoD, sync dashboards, open the PR, obtain and resolve the GitHub Copilot review, merge
clean, hand off to P3.

DELIVERABLES
1. Clean-state gate: `pnpm install && pnpm lint && pnpm typecheck && pnpm --filter api test` green;
   with `pnpm infra:up`: boot check, /health up, /system/config redacted, /system/recipes six
   entries, broken-env boot prints one aggregated report.
2. Update this phase file, docs/DEVELOPMENT_PLAN.md §1 (P2 row, counters, active phase -> P3),
   docs/tasks/README.md mirror.
3. `gh pr create --title "feat(api): phase 2, nest skeleton with canonical storage wiring" --body <professional summary>`.
4. Request the GitHub Copilot code review; address EVERY finding; re-request after substantive changes.
5. `gh pr merge --squash --delete-branch` only with CI green; `git switch main && git pull`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with a failing check; no --no-verify.

Verification:
- `gh pr view --json state` MERGED; remote branch gone; plan §1 shows P2 ✅ 6/6.

Completion Protocol:
1. Status ✅ in block + index; tick checkboxes; header Progress 6/6, phase ✅.
2. Update plan §1 + README mirror.
3. Append `- 2.6 ✅ YYYY-MM-DD: phase merged in PR #<n>`.
4. Commit dashboards on main: `docs(plan): mark P2 complete`.
```

## Completion log

<!-- append lines: - N.M ✅ YYYY-MM-DD: summary -->

- 2.1 ✅ 2026-07-07: bootable NestJS 11 shell — main.ts delegates to the exported createApp() seam (CORS + shutdown hooks, fail-fast exit), app.module.ts + root AppController (GET / -> { name, version, docs }), nest-cli.json + build/spec tsconfigs, unit jest.config.cjs (100/100/100/100, maxWorkers 50%, metadata-off spec tsconfig) and jest-e2e.config.mjs; app.controller + library-probe unit specs and a boot e2e smoke all green; lint/typecheck/format clean
- 2.2 ✅ 2026-07-07: Zod env schema (every §9.1 variable, coerced numbers, coercion-free envBoolean, enums for SCANNER_MODE/STORAGE_CHECKSUM_MODE, empty-or-URL for CDN/SSE); validateEnv throws ONE aggregated report by variable name + issue code (never values); loadEnv is the sole environment reader and namespaces the result under `env`; ConfigModule registers it globally via `load`; app.factory/main now consume the validated config (env.WEB_ORIGIN / env.PORT), 2.1 seam removed; invalid-env boot exits non-zero with one report; unit coverage 100/100/100/100
