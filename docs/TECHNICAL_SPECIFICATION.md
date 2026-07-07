# nest-storage-example: Technical Specification

> The canonical reference application for **`@bymax-one/nest-storage`**, a provider-agnostic S3
> object-storage layer for NestJS built on `@aws-sdk/client-s3` (uploads, multipart, streams,
> signed URLs, validation pipeline, virus-scan hook, key namespacing). A NestJS API plus a Next.js
> dashboard that exercises **every** public feature of the library in a runnable, realistic
> scenario, and makes the invisible parts (multipart thresholds, TTL clamping on signed URLs,
> validation pipelines, scanner verdicts, key-prefix isolation, provider quirks) tangible on screen.
>
> Maintained by **Bymax One** · MIT · Part of the `@bymax-one/*` reference-app family
> (`nest-auth-example`, `nest-logger-example`, `nest-cache-example`, ...).

---

> 📄 **About this document.** This is the authoritative, forward-looking technical blueprint for
> `nest-storage-example`, authored **before implementation**. It is the source the phased
> `DEVELOPMENT_PLAN.md` and the per-phase `docs/tasks/phase-NN-*.md` files derive from. It describes
> the intended end-state so that planning, task scaffolding, and review all share one contract.
> Where it prescribes a library surface, that surface comes from the library's technical
> specification at `@bymax-one/nest-storage@0.1.0`; any ambiguity is resolved against the library's
> published type declarations (`dist/server/index.d.ts`, `dist/shared/index.d.ts`), never guessed.

> ⚠️ **Library status.** `@bymax-one/nest-storage` is **pre-1.0 (`0.1.0`)** and not yet published to
> npm. This example pins the library locally (see §8) until it is published, then tracks `^0.1.0`.
> Any API drift is reconciled in this document, not papered over.

> 🔒 **Repository visibility.** The repository starts **private** and will become **public**. All
> documentation and code are written public-grade from day one, and the CI workflows gate
> public-only integrations (CodeQL, OpenSSF Scorecard) behind a repository-visibility condition so
> they activate automatically when the repo flips to public (§22).

---

## Table of Contents

1. [Purpose & Audience](#1--purpose--audience)
2. [Goals & Non-Goals](#2--goals--non-goals)
3. [Architecture at a Glance](#3--architecture-at-a-glance)
4. [The Library Under Test: `@bymax-one/nest-storage`](#4--the-library-under-test-bymax-onenest-storage)
5. [Tech Stack](#5--tech-stack)
6. [Repository Layout](#6--repository-layout)
7. [Feature Coverage Matrix](#7--feature-coverage-matrix)
8. [Library Consumption](#8--library-consumption)
9. [Configuration & Environment](#9--configuration--environment)
10. [Backend Design: `apps/api`](#10--backend-design-appsapi)
11. [Demo Domain & REST API](#11--demo-domain--rest-api)
12. [Demonstration Scenarios](#12--demonstration-scenarios)
13. [Frontend Design: `apps/web`](#13--frontend-design-appsweb)
14. [Design System](#14--design-system)
15. [Buckets & Storage Topology](#15--buckets--storage-topology)
16. [Upload Pipeline: Validation & Scanner](#16--upload-pipeline-validation--scanner)
17. [Signed URLs & Direct Browser Upload](#17--signed-urls--direct-browser-upload)
18. [Error Handling](#18--error-handling)
19. [Observability & Health](#19--observability--health)
20. [Local Stack & Docker](#20--local-stack--docker)
21. [Testing Strategy](#21--testing-strategy)
22. [Tooling, CI & Conventions](#22--tooling-ci--conventions)
23. [Security & Safety](#23--security--safety)
24. [Phased Delivery Plan](#24--phased-delivery-plan)
25. [What This Project Intentionally Excludes](#25--what-this-project-intentionally-excludes)
26. [References](#26--references)
27. [Document Status](#27--document-status)

---

## 1 · Purpose & Audience

`nest-storage-example` exists to do three things, in order of importance:

1. **Demonstrate every public feature** of `@bymax-one/nest-storage` in one runnable, realistic
   application: not isolated snippets, but a coherent document-vault domain where each storage
   capability earns its place.
2. **Make the invisible visible.** Multipart threshold decisions, upload progress, signed-URL TTL
   clamping, validation pipelines, scanner verdicts, key-prefix isolation, and provider quirks
   (checksum headers, ACL restrictions) are hard to appreciate from a README. A live dashboard
   renders them so a reader _sees_ an upload switch to multipart, _sees_ a signed URL expire,
   _sees_ an infected file rejected with its threat name.
3. **Serve as the canonical integration reference** for any Bymax project (or external consumer)
   adopting the library: the copy-paste-grade `forRootAsync` wiring, the exception filter, the
   magic-byte validator, the scanner adapter, the direct-browser-upload flow, and the
   dual-subpath shared-types pattern.

It doubles as the library's **dogfooding harness**: building the example against the published API
surfaces ergonomics and gaps a unit-test suite cannot.

**Audience:** backend engineers evaluating or adopting the library; frontend engineers wiring a
file-management UI; reviewers auditing the library's API; and AI agents executing the phased plan.

---

## 2 · Goals & Non-Goals

### Goals

- **G1: Total surface coverage.** Every export of `@bymax-one/nest-storage` (both subpaths) is
  demonstrated and tracked in the [Feature Coverage Matrix](#7--feature-coverage-matrix) (§7).
- **G2: Honest semantics.** No demo misrepresents what the library does. Where the library has a
  boundary (signed PUT bypasses local validation, ACL `public-read` fails on modern AWS S3, the
  in-memory idempotency cache is per-instance, checksum headers break non-AWS providers), the
  example demonstrates the boundary and the correct mitigation rather than hiding it.
- **G3: Production-grade wiring.** The `forRootAsync` factory, exception filter, graceful shutdown,
  validators, and scanner adapter are written the way a real service should write them.
- **G4: One visual product.** The dashboard is visually indistinguishable from the other Bymax
  example apps: same design system (§14), same shell, same brand.
- **G5: Minimal infra.** MinIO only by default; no database. The demo domain uses in-memory
  metadata stores so the focus stays on object storage.
- **G6: Authoritative documentation.** This spec, a phased plan, a polished README, and JSDoc-rich
  code that reads like a tutorial.

### Non-Goals

- **NG1: Not a production deployment template.** Local dev reference only; no Kubernetes/CD.
- **NG2: No authentication.** Out of scope: that is `@bymax-one/nest-auth`'s job. The dashboard is
  open on localhost. Tenant scoping is demonstrated with an explicit tenant switcher, not real auth.
- **NG3: No database / ORM.** Object metadata beyond what the provider stores is in-memory.
- **NG4: No real virus scanner daemon.** The scanner lab uses a deterministic in-process
  `IFileScanner` stub (marker-based verdicts). Real adapters (ClamAV, Macie) are documented, not run.
- **NG5: Not an S3 tutorial.** It assumes object-storage basics; it teaches the **library's**
  abstractions over S3-compatible providers.

---

## 3 · Architecture at a Glance

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                            Browser (localhost:3000)                            │
│ Next.js 16 dashboard · React 19 · Tailwind v4 · shadcn new-york · forced dark  │
│                                                                                │
│  Vault browser · Upload lab · Direct upload · Signed URLs · Validation lab     │
│  Scanner lab · Tenants · Error explorer · System                              │
│        │ REST (typed fetch)                    │ presigned PUT/GET (direct)    │
└────────┼───────────────────────────────────────┼───────────────────────────────┘
         ▼                                       │
┌──────────────────────────────────────────┐     │
│        apps/api (NestJS 11, :3001)       │     │
│                                          │     │
│  BymaxStorageModule.forRootAsync(env)    │     │
│    StorageService   SignedUrlService     │     │
│    validators[]     IFileScanner stub    │     │
│  StorageExceptionFilter · Zod pipes      │     │
│  vault/ uploads/ signed/ tenants/        │     │
│  scanner-lab/ errors-demo/ system/       │     │
└──────────────────┬───────────────────────┘     │
                   │ @aws-sdk/client-s3 (S3 API) │
                   ▼                             ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                     MinIO (localhost:9000, console :9001)                      │
│   bucket `vault` (default) · `vault-archive` (copy target) ·                   │
│   `vault-versioned` (versioning enabled)                                       │
└────────────────────────────────────────────────────────────────────────────────┘
```

Direct browser uploads (presigned PUT / presigned multipart) intentionally bypass `apps/api`,
because that is the pattern the library's `SignedUrlService` exists for; the confirm/verify
round-trip afterwards is part of the demonstrated flow (§17).

---

## 4 · The Library Under Test: `@bymax-one/nest-storage`

Provider-agnostic object storage for NestJS. One engine (`@aws-sdk/client-s3`), any S3-compatible
provider (AWS S3, DigitalOcean Spaces, Cloudflare R2, Backblaze B2, MinIO, Wasabi, Linode). Dynamic
module, `Symbol()` injection tokens, `dependencies: {}` (everything is a peer).

### 4.1 Public API inventory (server subpath `.`)

| Kind       | Export                                                                                                                                                                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module     | `BymaxStorageModule` (`forRoot` / `forRootAsync`)                                                                                                                                                                                                                                               |
| Services   | `StorageService`, `SignedUrlService`                                                                                                                                                                                                                                                            |
| Tokens     | `BYMAX_STORAGE_OPTIONS`, `BYMAX_STORAGE_S3_CLIENT`, `BYMAX_STORAGE_UPLOAD_VALIDATORS`, `BYMAX_STORAGE_FILE_SCANNER`, `BYMAX_STORAGE_LOGGER`                                                                                                                                                     |
| Interfaces | `BymaxStorageModuleOptions`, `UploadOptions`, `UploadResult`, `DownloadOptions`, `ListOptions`, `ListResult`, `SignedGetUrlOptions`, `SignedPutUrlOptions`, `SignedUrlResult`, `ObjectMetadata`, `IUploadValidator`, `IFileScanner`, `FileScanResult`, `ProviderRecipe`, `StorageErrorResponse` |
| Errors     | `StorageException`, `STORAGE_ERROR_CODES`                                                                                                                                                                                                                                                       |
| Helpers    | `providerRecipes` (aws, digitalOceanSpaces, cloudflareR2, backblazeB2, minio, wasabi), `NoOpUploadValidator`, `NoOpFileScanner`                                                                                                                                                                 |

`StorageService` methods: `upload`, `download`, `downloadBuffer`, `delete`, `deleteMany`, `list`,
`head`, `exists`, `copy`, `getPublicUrl`. `SignedUrlService` methods: `getDownloadUrl`,
`getUploadUrl`, `getMultipartUploadUrls`.

### 4.2 Public API inventory (shared subpath `./shared`)

Zero-dependency types and constants for frontends and workers: `UploadResult`, `ObjectMetadata`,
`StorageErrorResponse`, `SignedUrlResult`, `STORAGE_ERROR_CODES`, `DEFAULT_IMAGE_MIME_WHITELIST`,
`DEFAULT_VIDEO_MIME_WHITELIST`, `DEFAULT_DOC_MIME_WHITELIST`, `DEFAULT_SIGNED_URL_TTL_SECONDS`,
`DEFAULT_MULTIPART_THRESHOLD_BYTES`.

### 4.3 Key defaults this example makes visible

| Concern        | Default                                                                  | Where demonstrated |
| -------------- | ------------------------------------------------------------------------ | ------------------ |
| Signed URL TTL | GET/PUT 300 s; `maxTtlSeconds` 604800 s (SigV4 hard cap, clamped)        | §12.4, §17         |
| Multipart      | threshold 5 MiB, part 5 MiB, queueSize 4                                 | §12.2              |
| Headers        | `Cache-Control: public, max-age=31536000, immutable`, `inline`           | §12.1              |
| Scanner        | `mode: 'pre-upload'`, `rejectOnUnknown: false`                           | §16                |
| Checksums      | `WHEN_SUPPORTED` (SDK default); MinIO recipe opts out to `WHEN_REQUIRED` | §12.7              |
| Network        | `maxAttempts: 3`, `requestTimeoutMs: 30000`                              | §12.8              |
| Idempotency    | in-memory LRU, 1000 entries, 24 h TTL                                    | §12.3              |

---

## 5 · Tech Stack

| Layer     | Choice                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| Backend   | NestJS 11 (Express), TypeScript 5.9 strict, Zod DTOs (no Swagger, JSDoc-documented controllers)             |
| Library   | `@bymax-one/nest-storage@^0.1.0` (local `file:` link until published, then npm)                             |
| SDK peers | `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@aws-sdk/s3-request-presigner` (all `^3.700.0`)              |
| Frontend  | Next.js 16, React 19, Tailwind v4, shadcn `new-york`, TanStack Query, nuqs, Sonner                          |
| Storage   | MinIO (S3-compatible, Docker), three buckets (§15)                                                          |
| Testing   | Jest (api) + Vitest (web) at 100% coverage, supertest + Testcontainers MinIO e2e, Stryker, Playwright smoke |
| Tooling   | pnpm workspaces, ESLint 9 flat, Prettier 3, husky + commitlint + lint-staged, Renovate                      |
| Runtime   | Node `>=24`                                                                                                 |

---

## 6 · Repository Layout

```
nest-storage-example/
├── apps/
│   ├── api/                      # NestJS 11 backend (:3001)
│   │   ├── src/
│   │   │   ├── main.ts           # CORS, shutdown hooks, global pipe + filter
│   │   │   ├── app.module.ts
│   │   │   ├── config/           # env.schema.ts (Zod), storage.config.ts (canonical wiring)
│   │   │   ├── common/           # storage-exception.filter.ts, zod-validation.pipe.ts
│   │   │   ├── vault/            # browse/head/download/delete/copy (the document vault)
│   │   │   ├── uploads/          # single/multipart/stream/progress/idempotency
│   │   │   ├── signed/           # presigned GET/PUT/multipart + confirm flow
│   │   │   ├── validation-lab/   # MIME/size/magic-byte demos
│   │   │   ├── scanner-lab/      # stub scanner + verdict demos
│   │   │   ├── tenants/          # key-prefix isolation
│   │   │   ├── errors-demo/      # trigger every STORAGE_* code
│   │   │   └── system/           # health, config introspection, provider recipes
│   │   └── test/                 # e2e (supertest + Testcontainers MinIO)
│   └── web/                      # Next.js 16 dashboard (:3000)
│       ├── app/                  # pages: vault, upload, direct, signed, validation,
│       │                         # scanner, tenants, errors, system
│       ├── components/           # layout shell, vault browser, upload widgets, charts
│       └── lib/                  # api-client.ts, storage-status.ts, shared-subpath probe
├── docker/
│   └── minio/                    # entrypoint + bucket bootstrap (mc)
├── docker-compose.yml            # minio + minio-setup (bucket/versioning bootstrap)
├── docs/                         # this spec, DEVELOPMENT_PLAN.md, design_system.html, tasks/
└── scripts/                      # audit-library-exports.mjs
```

---

## 7 · Feature Coverage Matrix

The contract of this example: every row is demonstrated by a running feature, listed with its
primary surface. Phases in `DEVELOPMENT_PLAN.md` reference these rows; the Phase 9 export audit
fails CI if a library export has no demonstration.

### 7.1 Module, registration & configuration

| #   | Library surface                                                                       | Demonstration                                                               |
| --- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | `BymaxStorageModule.forRootAsync` (env-driven factory)                                | canonical wiring in `config/storage.config.ts` (the copy-paste reference)   |
| 2   | `BymaxStorageModule.forRoot` (sync)                                                   | e2e boot path with inline options                                           |
| 3   | Required-options validation at init                                                   | errors-demo: boot probe rendering `STORAGE_INVALID_CONFIG`                  |
| 4   | Missing credentials tolerated at init                                                 | system page: "not configured" mode, ops return `STORAGE_NOT_CONFIGURED` 503 |
| 5   | `providerRecipes` (aws, digitalOceanSpaces, cloudflareR2, backblazeB2, minio, wasabi) | system page recipe explorer; MinIO recipe runs live                         |
| 6   | `forcePathStyle`                                                                      | MinIO recipe (`true`) vs virtual-hosted rendering                           |
| 7   | `publicBaseUrl` / `cdnBaseUrl` → `getPublicUrl()`                                     | vault detail: public URL with and without CDN base                          |
| 8   | `defaultPublicRead` + modern-S3 ACL honesty                                           | §12.6 honest demo (ACL caveat surfaced, not hidden)                         |
| 9   | `keyPrefix` (global, per module instance)                                             | tenants page: instance prefix + app-level tenant prefixes                   |
| 10  | `defaultCacheControl` / `defaultContentDisposition`                                   | upload lab: header inspector on `head()` after upload                       |
| 11  | `signedUrls` defaults + `maxTtlSeconds` init clamp                                    | signed page: TTL clamp visualization (§12.4)                                |
| 12  | `multipart` threshold / partSize / queueSize                                          | upload lab: strategy indicator (§12.2)                                      |
| 13  | `validation` block enables `ValidationService`                                        | validation lab                                                              |
| 14  | `scanner` block enables `FileScannerService`                                          | scanner lab                                                                 |
| 15  | `serverSideEncryption: 'AES256'` global                                               | upload lab: SSE column on head metadata                                     |
| 16  | `kmsKeyId` + `'aws:kms'`                                                              | documented configuration demo (MinIO KMS caveat noted)                      |
| 17  | `requestChecksumCalculation` / `responseChecksumValidation`                           | §12.7: the checksum trap, `WHEN_REQUIRED` live on MinIO                     |
| 18  | `maxAttempts` / `requestTimeoutMs`                                                    | errors-demo: timeout trigger → `STORAGE_TIMEOUT` (§12.8)                    |
| 19  | Injection tokens (`BYMAX_STORAGE_OPTIONS`, `_LOGGER`)                                 | system config introspection endpoint                                        |

### 7.2 `StorageService`

| #   | Library surface                                    | Demonstration                                            |
| --- | -------------------------------------------------- | -------------------------------------------------------- |
| 20  | `upload()` single-shot (Buffer)                    | upload lab: small file, `multipart: false` in result     |
| 21  | `upload()` multipart (size ≥ threshold)            | upload lab: large file, `multipart: true`, part progress |
| 22  | `upload()` stream with known `size`                | upload lab: stream mode                                  |
| 23  | `upload()` stream with unknown size → multipart    | upload lab: forced-multipart indicator                   |
| 24  | `onProgress` events                                | upload lab: live progress bar (loaded/total/part)        |
| 25  | `idempotencyKey` → `fromIdempotencyCache`          | upload lab: repeat-upload demo (§12.3)                   |
| 26  | Automatic headers (cache, disposition, x-amz-meta) | vault detail metadata tab                                |
| 27  | Per-upload SSE override incl. `'NONE'` sentinel    | upload lab: SSE selector                                 |
| 28  | `download()` stream + metadata                     | vault: stream download proxy route                       |
| 29  | `downloadBuffer()` (small files)                   | vault: inline preview (images)                           |
| 30  | `download({ range })`                              | vault detail: first-KiB hex preview                      |
| 31  | `download({ versionId })`                          | versioned bucket demo (§15)                              |
| 32  | `delete()` idempotent                              | vault: delete (second delete logs warning, no throw)     |
| 33  | `deleteMany()` chunked, per-key failures           | vault: bulk delete with partial-failure rendering        |
| 34  | `list()` prefix / maxKeys / continuationToken      | vault browser pagination                                 |
| 35  | `list({ delimiter: '/' })` + `commonPrefixes`      | vault folder navigation                                  |
| 36  | `head()`                                           | vault detail drawer                                      |
| 37  | `exists()`                                         | vault: existence check on rename/copy targets            |
| 38  | `copy()` same-bucket and cross-bucket              | vault: copy-to-archive action (§15)                      |
| 39  | `getPublicUrl()`                                   | vault detail: unsigned URL rendering                     |

### 7.3 `SignedUrlService` & direct upload

| #   | Library surface                                              | Demonstration                                                 |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| 40  | `getDownloadUrl()` + response overrides                      | signed page: attachment filename override, expiry countdown   |
| 41  | Silent TTL clamp (request above `maxTtlSeconds`)             | signed page: requested vs effective TTL rendered side by side |
| 42  | `ttlSeconds ≤ 0` → `STORAGE_SIGNED_URL_TTL_INVALID`          | signed page + errors-demo                                     |
| 43  | `getUploadUrl()` + `maxSizeBytes` length policy              | direct upload page: browser PUT straight to MinIO             |
| 44  | `SignedUrlResult.requiredHeaders` honored                    | direct upload: headers echoed and applied by the client       |
| 45  | `getMultipartUploadUrls()` (uploadId, partUrls, completeUrl) | direct upload: big-file browser multipart lab                 |
| 46  | Signed PUT bypasses local validation (honest boundary)       | §12.5: post-upload `head()` + scanner verify pattern          |

### 7.4 Validation, scanner, errors & shared subpath

| #   | Library surface                                            | Demonstration                                                       |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| 47  | MIME whitelist with wildcards                              | validation lab: `image/*` pass, `application/zip` reject 415        |
| 48  | `maxSizeBytes` → `STORAGE_SIZE_EXCEEDED` 413               | validation lab                                                      |
| 49  | `IUploadValidator` + `readBytes` magic-byte sniffing       | validation lab: PDF magic-byte validator (declared PDF, fake bytes) |
| 50  | `NoOpUploadValidator` default                              | config introspection: validators array when none configured         |
| 51  | `IFileScanner` + `FileScanResult` (clean/infected/unknown) | scanner lab: marker-based stub verdicts                             |
| 52  | Scanner `mode: 'pre-upload'` vs `'post-upload'`            | scanner lab: mode toggle, post-upload removal proof                 |
| 53  | `rejectOnUnknown` both values                              | scanner lab: `STORAGE_SCAN_INCONCLUSIVE` vs pass-with-warning       |
| 54  | `NoOpFileScanner` default                                  | config introspection                                                |
| 55  | Key normalization + path traversal guard                   | errors-demo: `../etc/passwd` → `STORAGE_KEY_INVALID` 400            |
| 56  | All `STORAGE_ERROR_CODES` + `StorageException` envelope    | error explorer: every code triggered on demand (§18)                |
| 57  | AWS SDK → `StorageException` mapping                       | errors-demo: not-found, provider-error, timeout paths               |
| 58  | Raw client via `BYMAX_STORAGE_S3_CLIENT`                   | system: advanced ops (bucket versioning status) with trade-off note |
| 59  | `./shared` zero-dependency browser import                  | `apps/web` probe + typed api-client error codes                     |
| 60  | Shared constants (default whitelists, TTLs, threshold)     | validation lab + upload lab render the constants they enforce       |

---

## 8 · Library Consumption

The example consumes `@bymax-one/nest-storage` as a **versioned external package**, never as a
workspace member, so it validates the published artifact (`dist/` + `package.json#exports`), the
subpath map, and the dual ESM/CJS build exactly as a real consumer does.

### 8.1 Linking modes

```jsonc
// apps/api/package.json (and apps/web for ./shared) until the library is published:
"@bymax-one/nest-storage": "file:../../../nest-storage"
// after publish:
"@bymax-one/nest-storage": "^0.1.0"
```

The library's peers (`@nestjs/common ^11`, `@nestjs/core ^11`, `@aws-sdk/client-s3 ^3.700.0`,
`@aws-sdk/lib-storage ^3.700.0`, `@aws-sdk/s3-request-presigner ^3.700.0`, `reflect-metadata ^0.2`)
are declared in `apps/api` so they resolve to a single copy. `apps/web` imports **only**
`./shared` (zero-dependency) and declares none of the peers: the absence is the proof (matrix #59).

### 8.2 Subpath usage

| Subpath    | Used by    | Imports                                                        |
| ---------- | ---------- | -------------------------------------------------------------- |
| `.`        | `apps/api` | module, services, tokens, interfaces, errors, recipes, helpers |
| `./shared` | both apps  | `STORAGE_ERROR_CODES`, result types, default whitelists/TTLs   |

---

## 9 · Configuration & Environment

### 9.1 Environment variables (`apps/api`)

| Variable                      | Default (dev)                 | Purpose                                                                                  |
| ----------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| `NODE_ENV`                    | `development`                 | mode switches (pretty errors, scanner defaults)                                          |
| `PORT`                        | `3001`                        | API port                                                                                 |
| `WEB_ORIGIN`                  | `http://localhost:3000`       | CORS                                                                                     |
| `STORAGE_ENDPOINT`            | `http://localhost:9000`       | MinIO S3 endpoint                                                                        |
| `STORAGE_REGION`              | `us-east-1`                   | region (MinIO accepts any)                                                               |
| `STORAGE_BUCKET`              | `vault`                       | default bucket                                                                           |
| `STORAGE_ARCHIVE_BUCKET`      | `vault-archive`               | cross-bucket copy target                                                                 |
| `STORAGE_VERSIONED_BUCKET`    | `vault-versioned`             | versioning demo                                                                          |
| `STORAGE_ACCESS_KEY_ID`       | `minioadmin`                  | dev credentials (never real keys)                                                        |
| `STORAGE_SECRET_ACCESS_KEY`   | `minioadmin`                  | dev credentials                                                                          |
| `STORAGE_FORCE_PATH_STYLE`    | `true`                        | MinIO path-style                                                                         |
| `STORAGE_PUBLIC_BASE_URL`     | `http://localhost:9000/vault` | unsigned public URLs                                                                     |
| `STORAGE_CDN_BASE_URL`        | (empty)                       | when set, `getPublicUrl` switches to CDN                                                 |
| `STORAGE_KEY_PREFIX`          | `storage-example`             | global instance prefix                                                                   |
| `STORAGE_SSE`                 | (empty)                       | `AES256` to enable global SSE (MinIO supports SSE-S3 when KMS is configured; documented) |
| `STORAGE_CHECKSUM_MODE`       | `WHEN_REQUIRED`               | the non-AWS checksum opt-out (matrix #17)                                                |
| `STORAGE_MAX_TTL_SECONDS`     | `3600`                        | signed-URL cap for the clamp demo                                                        |
| `STORAGE_MULTIPART_THRESHOLD` | `5242880`                     | 5 MiB threshold                                                                          |
| `SCANNER_MODE`                | `pre-upload`                  | scanner lab default                                                                      |
| `SCANNER_REJECT_ON_UNKNOWN`   | `false`                       | scanner lab default                                                                      |
| `UPLOAD_MAX_SIZE_BYTES`       | `26214400`                    | 25 MiB validation cap                                                                    |

Web: `NEXT_PUBLIC_API_URL` (`http://localhost:3001`). Every variable is Zod-validated in
`apps/api/src/config/env.schema.ts`; the app fails fast with an aggregated report on boot.

### 9.2 The canonical wiring: `config/storage.config.ts`

A single exported factory `buildStorageOptions(env)` returns `BymaxStorageModuleOptions` from the
validated env. This file is the artifact consumers copy: it exercises every configuration block of
the library in one place.

```typescript
/**
 * @fileoverview Builds the resolved BymaxStorageModuleOptions from the validated environment.
 * @layer Config
 */
import type { BymaxStorageModuleOptions } from '@bymax-one/nest-storage'
import {
  DEFAULT_DOC_MIME_WHITELIST,
  DEFAULT_IMAGE_MIME_WHITELIST,
} from '@bymax-one/nest-storage/shared'
import type { Env } from './env.schema'
import { PdfMagicByteValidator } from '../validation-lab/pdf-magic-byte.validator'
import { MarkerFileScanner } from '../scanner-lab/marker-file.scanner'

/**
 * Maps the validated environment onto the library options, wiring every
 * configuration block the example demonstrates: connection, key prefix,
 * headers, signed URL policy, multipart thresholds, the validation
 * pipeline, the scanner hook, checksum mode, and network knobs.
 */
export const buildStorageOptions = (env: Env): BymaxStorageModuleOptions => ({
  endpoint: env.STORAGE_ENDPOINT,
  region: env.STORAGE_REGION,
  bucket: env.STORAGE_BUCKET,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  },
  forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
  publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
  ...(env.STORAGE_CDN_BASE_URL ? { cdnBaseUrl: env.STORAGE_CDN_BASE_URL } : {}),
  keyPrefix: env.STORAGE_KEY_PREFIX,
  defaultCacheControl: 'public, max-age=31536000, immutable',
  defaultContentDisposition: 'inline',
  signedUrls: {
    defaultGetTtlSeconds: 300,
    defaultPutTtlSeconds: 300,
    // Deliberately reduced from the 604800 s SigV4 cap so the clamp demo is visible.
    maxTtlSeconds: env.STORAGE_MAX_TTL_SECONDS,
  },
  multipart: {
    thresholdBytes: env.STORAGE_MULTIPART_THRESHOLD,
    partSizeBytes: 5_242_880,
    queueSize: 4,
  },
  validation: {
    mimeWhitelist: [...DEFAULT_IMAGE_MIME_WHITELIST, ...DEFAULT_DOC_MIME_WHITELIST, 'video/*'],
    maxSizeBytes: env.UPLOAD_MAX_SIZE_BYTES,
    customValidators: [new PdfMagicByteValidator()],
  },
  scanner: {
    impl: new MarkerFileScanner(),
    mode: env.SCANNER_MODE,
    rejectOnUnknown: env.SCANNER_REJECT_ON_UNKNOWN,
  },
  ...(env.STORAGE_SSE ? { serverSideEncryption: env.STORAGE_SSE } : {}),
  // MinIO (and R2/B2/Spaces) reject the SDK's default CRC32 integrity headers.
  requestChecksumCalculation: env.STORAGE_CHECKSUM_MODE,
  responseChecksumValidation: env.STORAGE_CHECKSUM_MODE,
  maxAttempts: 3,
  requestTimeoutMs: 30_000,
})
```

And the module registration in `app.module.ts`, the shape every consumer copies:

```typescript
BymaxStorageModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) =>
    buildStorageOptions(config.get('env', { infer: true })),
})
```

---

## 10 · Backend Design: `apps/api`

### 10.1 Module map

| Module            | Responsibility                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `config/`         | env schema (Zod) + `storage.config.ts` factory                                                              |
| `common/`         | `StorageExceptionFilter` (`@Catch(StorageException)` → envelope pass-through), `ZodValidationPipe`          |
| `vault/`          | browse (list/delimiter), detail (head), download (stream/buffer/range), delete/deleteMany, copy, public URL |
| `uploads/`        | server-side uploads: single, multipart, stream, progress, idempotency, SSE override                         |
| `signed/`         | presigned GET/PUT/multipart issuance + post-upload confirm/verify                                           |
| `validation-lab/` | endpoints that intentionally violate MIME/size/magic-byte rules                                             |
| `scanner-lab/`    | marker-driven scan verdicts, mode + rejectOnUnknown toggles                                                 |
| `tenants/`        | tenant-prefixed keys, per-tenant listing and clearing                                                       |
| `errors-demo/`    | trigger every `STORAGE_*` code deterministically                                                            |
| `system/`         | health, config introspection (resolved options, redacted), provider recipes, raw-client advanced ops        |

### 10.2 House style

Controllers are thin (validate with Zod, delegate to a service, return typed shapes), documented
with JSDoc route headers (no Swagger). Services own the library calls. Every file carries the
`@fileoverview` + `@layer` header; every export has imperative JSDoc.

### 10.3 Progress reporting

`onProgress` callbacks stream to the dashboard via short-poll of an in-memory upload-session store
(keeps infra minimal; no WebSocket needed for this lib). Each upload session records
`{ loaded, total, part, strategy }` snapshots the UI renders as a live bar.

---

## 11 · Demo Domain & REST API

The domain is a **document vault**: workspaces (tenants) store avatars (images), invoices (PDFs),
attachments (any type), and media (large videos). Object keys follow
`{keyPrefix}/{tenant}/{category}/{uuid}.{ext}` composed app-side; in-memory catalogs hold nothing
the provider already knows (metadata lives on the objects).

### 11.1 Endpoint catalogue

**Vault (browse & lifecycle)**

| Route                          | Library calls                    | Notes                                                                                               |
| ------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET /vault`                   | `list()`                         | `prefix`, `delimiter`, `maxKeys`, `cursor` query; returns `{ objects, commonPrefixes, nextCursor }` |
| `GET /vault/object`            | `head()`                         | full `ObjectMetadata` for the detail drawer                                                         |
| `GET /vault/object/download`   | `download()`                     | streams with `Content-Type`/`Length`/`Disposition` from metadata                                    |
| `GET /vault/object/preview`    | `downloadBuffer()`               | small images only, size-guarded at 10 MiB                                                           |
| `GET /vault/object/range`      | `download({ range })`            | `bytes=0-1023`, returns base64 for the hex panel                                                    |
| `GET /vault/object/version`    | `download({ versionId })`        | versioned bucket only                                                                               |
| `DELETE /vault/object`         | `delete()`                       | idempotent; repeat delete returns 200 with a `warned` flag                                          |
| `POST /vault/bulk-delete`      | `deleteMany()`                   | returns `{ deleted, failed }` verbatim                                                              |
| `POST /vault/copy`             | `copy()` (+ `exists()` precheck) | `destinationBucket` optional (archive)                                                              |
| `GET /vault/object/public-url` | `getPublicUrl()`                 | renders both plain and CDN forms                                                                    |

**Uploads (server-side)**

| Route                        | Library calls                      | Notes                                                  |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------ |
| `POST /uploads/single`       | `upload()` (Buffer)                | multer memory storage; returns `UploadResult`          |
| `POST /uploads/multipart`    | `upload()` (size ≥ threshold)      | `onProgress` snapshots into the session store          |
| `POST /uploads/stream`       | `upload()` (Readable)              | `?knownSize=false` drops `size` to force multipart     |
| `GET /uploads/sessions/:id`  | (app-level)                        | progress snapshots `{ loaded, total, part, strategy }` |
| `POST /uploads/idempotent`   | `upload({ idempotencyKey })`       | response surfaces `fromIdempotencyCache`               |
| `POST /uploads/sse-override` | `upload({ serverSideEncryption })` | per-call `AES256` / `'NONE'` sentinel                  |

**Signed URLs & direct upload**

| Route                         | Library calls               | Notes                                                      |
| ----------------------------- | --------------------------- | ---------------------------------------------------------- |
| `POST /signed/download-url`   | `getDownloadUrl()`          | `responseContentDisposition` / `responseContentType` knobs |
| `POST /signed/upload-url`     | `getUploadUrl()`            | `maxSizeBytes` length policy; echoes `requiredHeaders`     |
| `POST /signed/multipart-urls` | `getMultipartUploadUrls()`  | `{ uploadId, partUrls, completeUrl }`                      |
| `POST /signed/confirm`        | `head()` + scanner `scan()` | the post-direct-upload verification pattern (§12.5)        |

**Labs, tenants, errors, system**

| Route                        | Library calls                              | Notes                                               |
| ---------------------------- | ------------------------------------------ | --------------------------------------------------- |
| `POST /validation/upload`    | `upload()` through the validation pipeline | `?path=mime\|size\|magic` selects the failing stage |
| `POST /scanner/upload`       | `upload()` through the scanner             | verdict driven by content marker (§16)              |
| `GET /scanner/config`        | (introspection)                            | active mode + `rejectOnUnknown`                     |
| `GET /tenants/:t/objects`    | `list({ prefix })`                         | tenant prefix under the instance `keyPrefix`        |
| `POST /tenants/:t/upload`    | `upload()`                                 | tenant-composed key                                 |
| `DELETE /tenants/:t/objects` | `list()` + `deleteMany()`                  | clears one tenant, proves isolation                 |
| `POST /errors/:code`         | varies                                     | deterministic trigger per `STORAGE_*` code          |
| `GET /health`                | `exists()` probe                           | `{ status, latencyMs, bucket }`                     |
| `GET /system/config`         | `BYMAX_STORAGE_OPTIONS` token              | resolved options, credentials redacted              |
| `GET /system/recipes`        | `providerRecipes`                          | rendered per provider with quirk annotations        |
| `GET /system/versioning`     | raw `BYMAX_STORAGE_S3_CLIENT`              | bucket versioning status (advanced-ops demo)        |

### 11.2 Documented journeys

1. **Upload → browse → head → download → delete** (the core lifecycle).
2. **Direct browser upload**: signed PUT → provider → confirm (head + scanner) → appears in vault.
3. **Big file**: multipart threshold crossing, live part progress, abort semantics.
4. **Tenant isolation**: clear tenant A, tenant B untouched; the global `keyPrefix` boundary.
5. **Hostile input**: traversal key, oversized file, fake PDF, infected marker, each mapped to its
   error code and rendered by the same typed client.

---

## 12 · Demonstration Scenarios

### 12.1 Headers & metadata

Upload with defaults, then `head()`: the detail drawer shows `Cache-Control`,
`Content-Disposition`, SSE, and `x-amz-meta-*` round-tripping. Overrides per upload are compared
against the configured defaults (matrix #10, #26).

### 12.2 Single-shot vs multipart vs stream

The upload lab shows the strategy decision live: a 1 MiB file goes single-shot
(`multipart: false`), a 12 MiB file crosses the threshold (`multipart: true`, part progress ticks),
a stream without `size` forces multipart. The threshold itself is rendered from the shared constant
so the UI and the library can never disagree (matrix #12, #20-#24, #60).

### 12.3 Idempotent upload

Same `idempotencyKey` twice: second result returns instantly with `fromIdempotencyCache: true`.
The per-instance boundary (in-memory LRU) is stated on the card, not hidden (matrix #25).

### 12.4 Signed URL TTL clamp

Request 24 h on a 1 h cap: the UI renders requested vs effective `expiresAt` and a countdown; at
expiry the same link is fetched again and the provider's denial is shown. `ttlSeconds: 0` renders
the `STORAGE_SIGNED_URL_TTL_INVALID` envelope (matrix #41, #42).

### 12.5 Signed PUT bypasses validation (honest boundary)

A file that local validation would reject uploads successfully via signed PUT, then the confirm
step (`head()` size check + post-upload scan) catches it: the documented mitigation, demonstrated
end to end (matrix #46).

### 12.6 The ACL honesty card

`publicRead: true` against providers with ACLs disabled fails with a clear hint. The demo surfaces
the library's documented guidance (bucket policy / CDN / signed URLs) instead of pretending ACLs
work everywhere (matrix #8).

### 12.7 The checksum trap

The system page renders `requestChecksumCalculation` live. A toggle endpoint (dev-only) flips the
mode to `WHEN_SUPPORTED` against MinIO and shows the provider rejection, proving why the non-AWS
recipes opt out (matrix #17).

### 12.8 Timeout & retry knobs

`POST /errors/STORAGE_TIMEOUT` points a scoped client at an unroutable endpoint with a short
`requestTimeoutMs`, rendering the mapped 504 envelope; `maxAttempts` is explained on the same card
(matrix #18, #57).

---

## 13 · Frontend Design: `apps/web`

### 13.1 Data layer

`lib/api-client.ts`: typed fetch wrapper whose error union is keyed by `STORAGE_ERROR_CODES` from
`./shared`; TanStack Query for caching; `nuqs` for URL state (vault path, filters); direct PUT
helpers that honor `SignedUrlResult.requiredHeaders`.

### 13.2 Pages

| Route         | Page                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`           | Overview: bucket stats, config summary, quick actions, recent uploads                                                                                     |
| `/vault`      | Folder browser (delimiter navigation), virtualized object table, detail drawer (Metadata / Preview / Range hex / URLs tabs), copy-to-archive, bulk delete |
| `/upload`     | Upload lab: drag-and-drop, strategy indicator, progress bars, idempotency card, SSE selector                                                              |
| `/direct`     | Direct upload: signed PUT + signed multipart, required-headers inspector, confirm step                                                                    |
| `/signed`     | Signed URLs: GET link generator, TTL clamp visualization, expiry countdown                                                                                |
| `/validation` | Validation lab: whitelist matrix, size limit, magic-byte forgery demo                                                                                     |
| `/scanner`    | Scanner lab: verdict cards (clean / infected / unknown), mode + rejectOnUnknown toggles                                                                   |
| `/tenants`    | Tenant switcher, per-tenant listing, isolation proof                                                                                                      |
| `/errors`     | Error explorer: all 17 codes, response envelope panel                                                                                                     |
| `/system`     | Health, resolved config (redacted), provider recipes, versioning status                                                                                   |

### 13.3 Signature components

`UploadDropzone` (strategy + progress), `TtlCountdown` (signed URL expiry ring), `VerdictCard`
(scanner), `EnvelopePanel` (typed error rendering), `FolderBreadcrumbs` (delimiter navigation),
`HexPreview` (range download).

---

## 14 · Design System

The dashboard reuses the shared Bymax example design system **verbatim**: see
[`design_system.html`](design_system.html) (copied from the sibling family). Tokens, Geist fonts,
forced dark mode, the 64 px topbar + 250 px grouped sidebar shell, orange active states, and the
glass-morphism cards are identical to `nest-auth-example` / `nest-logger-example` /
`nest-cache-example`. The four files (`app/globals.css`, `tailwind.config.ts`, `components.json`,
`postcss.config.mjs`) are copied verbatim from a sibling `apps/web`.

**Acceptance criterion:** a screenshot of this dashboard placed beside a sibling is
indistinguishable in chrome; only the domain content differs. Brand wordmark:
`nest-storage-example`.

---

## 15 · Buckets & Storage Topology

| Bucket            | Purpose                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `vault`           | default bucket, all primary demos                                       |
| `vault-archive`   | cross-bucket `copy()` target (matrix #38)                               |
| `vault-versioned` | versioning enabled at bootstrap; `download({ versionId })` (matrix #31) |

A `minio-setup` one-shot compose service (using `mc`) creates the buckets, enables versioning on
`vault-versioned`, and seeds a handful of sample objects so the vault renders on first boot.
Versioning support differs across real providers; the demo states this and runs it on MinIO.

---

## 16 · Upload Pipeline: Validation & Scanner

The example wires the full pipeline in the documented order (key resolution → MIME → size → custom
validators → scanner → provider) and demonstrates each stage failing independently:

- **MIME whitelist** from `DEFAULT_IMAGE_MIME_WHITELIST` + `application/pdf`, with a wildcard row.
- **Magic-byte validator**: `PdfMagicByteValidator implements IUploadValidator` using `readBytes(4)`;
  a text file renamed `.pdf` with `contentType: application/pdf` is rejected with the validator's
  reason in `details` (matrix #49).
- **Stub scanner**: `MarkerFileScanner implements IFileScanner`. Deterministic verdicts by content
  marker: a body containing `X-DEMO-INFECTED` → `infected` (threat `Demo.Marker.A`); containing
  `X-DEMO-UNKNOWN` → `unknown`; anything else → `clean`. Pre-upload mode rejects before bytes reach
  the bucket; post-upload mode uploads then removes, and the lab proves the removal with an
  `exists()` check (matrix #51-#53). Real adapters (ClamAV socket, AWS Macie) are documented as the
  production path.

---

## 17 · Signed URLs & Direct Browser Upload

The direct-upload page performs the real three-step flow against MinIO from the browser:

1. `POST /signed/upload-url` (contentType, size) → `{ url, requiredHeaders, expiresAt }`.
2. Browser `PUT` with exactly `requiredHeaders`; an over-limit body is rejected by the provider's
   Content-Length-Range policy (rendered).
3. `POST /signed/confirm` → `head()` + post-upload scan + vault registration.

The multipart variant drives `getMultipartUploadUrls()`: the browser splits the file, PUTs each
part to its URL, then completes; the abort path is also exercised so orphan parts are not left
behind. Security rules from the library docs are visible in the UI copy: shortest viable TTL, no
signed-URL logging, per-user URLs.

---

## 18 · Error Handling

`StorageExceptionFilter` (`@Catch(StorageException)`) passes the library envelope through
unchanged; the error explorer triggers **all 17 codes**:

`STORAGE_NOT_CONFIGURED` (503, scoped unconfigured module instance) · `STORAGE_KEY_INVALID` (400,
traversal) · `STORAGE_BODY_MISSING` (400) · `STORAGE_CONTENT_TYPE_REQUIRED` (400) ·
`STORAGE_MIME_NOT_ALLOWED` (415) · `STORAGE_SIZE_EXCEEDED` (413) · `STORAGE_VALIDATION_FAILED`
(400, magic-byte) · `STORAGE_SCAN_INFECTED` (422) · `STORAGE_SCAN_INCONCLUSIVE` (422) ·
`STORAGE_OBJECT_NOT_FOUND` (404) · `STORAGE_PROVIDER_ERROR` (502, wrong credentials probe) ·
`STORAGE_SIGNED_URL_TTL_INVALID` (400) · `STORAGE_PART_TOO_SMALL` (400) ·
`STORAGE_BUCKET_UNDEFINED` (400) · `STORAGE_MULTIPART_ABORTED` (500, raw presigned path abort) ·
`STORAGE_INVALID_CONFIG` (500, boot probe) · `STORAGE_TIMEOUT` (504).

The web client types every response with `STORAGE_ERROR_CODES` from `./shared` (matrix #56, #59).

---

## 19 · Observability & Health

- `GET /health`: a cheap `exists()` probe against the default bucket + latency, rendered as the
  dashboard status chip.
- `GET /system/config`: the resolved options (credentials redacted) proving what the module runs
  with; powers the config introspection page.
- Structured request logging via the NestJS logger; the optional `@bymax-one/nest-logger` bridge is
  documented as the production pattern, not wired (keeps the peer surface minimal).

---

## 20 · Local Stack & Docker

```yaml
# docker-compose.yml (shape)
services:
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports: ['127.0.0.1:9000:9000', '127.0.0.1:9001:9001']
    environment: { MINIO_ROOT_USER: minioadmin, MINIO_ROOT_PASSWORD: minioadmin }
    healthcheck: { test: ['CMD', 'mc', 'ready', 'local'] }
    volumes: [minio-data:/data]
  minio-setup:
    image: minio/mc:latest
    depends_on: { minio: { condition: service_healthy } }
    entrypoint: /docker/minio/setup.sh # buckets + versioning + seed objects
```

Ports: API `3001`, web `3000`, MinIO S3 `9000`, MinIO console `9001`. Root scripts:
`infra:up` / `infra:down` / `infra:nuke` / `infra:logs`. Local run: `pnpm infra:up`, `pnpm dev`,
open `http://localhost:3000`.

---

## 21 · Testing Strategy

Full library-grade bar, identical to the sibling reference apps (this repo is copied as a
template, and the library is proven here before publish):

| Tier              | Tool                                                            | Bar                                      |
| ----------------- | --------------------------------------------------------------- | ---------------------------------------- |
| API unit          | Jest (`tsconfig.spec.json` with metadata off)                   | **100/100/100/100** coverage             |
| Web unit          | Vitest + coverage-v8                                            | **100/100/100/100** coverage             |
| API e2e           | supertest + Testcontainers MinIO (`minio/minio`)                | every HTTP route + every error path      |
| Direct-upload e2e | real `fetch` PUT against the container using issued signed URLs | signed GET/PUT/multipart round-trips     |
| Web build/smoke   | `next build` + Playwright journeys                              | shell, vault browse, upload, error panel |
| Mutation          | Stryker (api `break: 100`, web `break: 90`, lib code 100)       | survivors documented as equivalents      |
| Export audit      | `scripts/audit-library-exports.mjs`                             | every library export demonstrated        |

Every `it()` carries a scenario comment. Suites run sequentially with bounded workers
(`maxWorkers: '50%'`); one Testcontainers MinIO at a time.

---

## 22 · Tooling, CI & Conventions

- pnpm workspaces (`apps/*`), Node `>=24`, TypeScript 5.9 strict (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`), ESLint 9 flat + Prettier 3, husky + commitlint + lint-staged,
  Renovate.
- **CI from day one** (Phase 0): `lint`, `typecheck`, `format:check`, then `test:cov`, `e2e`,
  `web-build`, `mutation`, `export-usage` join as their phases land, each incremental-safe.
- **Public-only jobs are conditional**: CodeQL and OpenSSF Scorecard workflows run behind
  `if: ${{ !github.event.repository.private }}` so they are inert while the repo is private and
  activate automatically on the visibility flip. Secret scanning and dependency review run
  regardless.
- Conventional Commits; branch names `feat/phase-NN-<slug>` created with `git switch -c`; one PR
  per phase with a GitHub Copilot review (§ DEVELOPMENT_PLAN conventions).
- English-only identifiers, comments, and docs; timeless comments (no plan-stage references in
  committed code or config).

---

## 23 · Security & Safety

- Dev credentials only (`minioadmin`); never a real key in the repo; secret scan stays clean.
- Signed URLs are never logged; the UI masks query strings in rendered URLs.
- Path traversal is demonstrated against the library guard, and the app validates user input
  before composing keys anyway (defense in depth).
- The "infected" fixture is an inert text marker (`X-DEMO-INFECTED`), never a real malware sample
  and never the EICAR binary; the scanner lab is deterministic and safe to run anywhere.
- Uploaded demo content is disposable; `infra:nuke` wipes the volumes.
- Keys never contain PII; the vault composes keys from UUIDs and category slugs only.

---

## 24 · Phased Delivery Plan

The authoritative decomposition lives in [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md) (10 phases,
P0 to P9) with per-phase task files under [`tasks/`](tasks/). Coarse shape:

| Phase | Focus                                                                              |
| ----- | ---------------------------------------------------------------------------------- |
| 0     | Repository foundation, toolchain, **CI from day one**                              |
| 1     | MinIO stack (3 buckets, versioning, seed) + library link + subpath probes          |
| 2     | API skeleton: env schema, canonical `forRootAsync` wiring, filter, health, recipes |
| 3     | Core object operations: uploads (all strategies) + downloads                       |
| 4     | Listing, folders, lifecycle ops (delete/deleteMany/copy/exists/head/publicUrl)     |
| 5     | Signed URLs + direct browser upload (+ confirm pattern)                            |
| 6     | Validation pipeline + scanner lab                                                  |
| 7     | Tenants, raw-client advanced ops, error explorer, provider quirks                  |
| 8     | Web dashboard: design system + all pages                                           |
| 9     | Quality: 100% unit, full e2e, Stryker, export audit, README, public-flip checklist |

---

## 25 · What This Project Intentionally Excludes

CDN configuration, image transformation, video transcoding, PDF processing, metadata databases,
per-user quotas, real scanner daemons, cross-region replication, production deployment manifests,
and authentication. Each exclusion mirrors the library's own scope decisions or belongs to another
`@bymax-one/*` lib; the README states where each concern lives.

---

## 26 · References

- Library: `github.com/bymaxone/nest-storage` (technical specification, README)
- Sibling reference apps: `nest-auth-example`, `nest-logger-example`, `nest-cache-example`
- AWS SDK for JavaScript v3: `docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/`
- MinIO: `min.io/docs`
- S3 API: `docs.aws.amazon.com/AmazonS3/latest/API/`

---

## 27 · Document Status

| Version | Date       | Status                                         |
| ------- | ---------- | ---------------------------------------------- |
| 1.0.0   | 2026-07-06 | Draft for implementation, authored before code |

This document is the contract. Reconcile drift here first, then in code.
