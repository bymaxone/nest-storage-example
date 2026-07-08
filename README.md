<p align="center">
  <img src="https://img.shields.io/badge/%40bymax--one-nest--storage--example-000000?style=for-the-badge&logo=nestjs&logoColor=E0234E" alt="nest-storage-example" />
</p>

<h1 align="center">nest-storage-example</h1>

<p align="center">
  <strong>Reference application for <a href="https://github.com/bymaxone/nest-storage"><code>@bymax-one/nest-storage</code></a></strong><br />
  <sub>NestJS 11 · Next.js 16 · React 19 · MinIO / S3 · Presigned URLs · Validation + Marker Scanner · Multi-tenant</sub>
</p>

<p align="center">
  <a href="https://github.com/bymaxone/nest-storage-example/actions/workflows/ci.yml"><img src="https://github.com/bymaxone/nest-storage-example/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/coverage-100%25-brightgreen?style=flat-square" alt="coverage 100%" />
  <img src="https://img.shields.io/badge/mutation-api%20100%20%C2%B7%20web%20%E2%89%A590-brightgreen?style=flat-square" alt="mutation api 100 / web >= 90" />
  <img src="https://img.shields.io/badge/lib-%40bymax--one%2Fnest--storage%20%5E0.1.0-6E56CF?style=flat-square" alt="library" />
  <a href="https://github.com/bymaxone/nest-storage-example/blob/main/LICENSE"><img src="https://img.shields.io/github/license/bymaxone/nest-storage-example?style=flat-square&colorA=000000&colorB=000000" alt="license" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript strict" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-24%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 24+" /></a>
  <a href="https://nestjs.com/"><img src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS 11" /></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js 16" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://min.io/"><img src="https://img.shields.io/badge/MinIO%20%2F%20S3-compatible-C72E49?style=flat-square&logo=minio&logoColor=white" alt="MinIO / S3" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind 4" /></a>
</p>

<p align="center">
  <a href="https://github.com/bymaxone/nest-storage">📦 Library</a> ·
  <a href="#-quick-start">🚀 Quick Start</a> ·
  <a href="#-whats-inside">✅ Features</a> ·
  <a href="#-architecture">🏗️ Architecture</a> ·
  <a href="docs/TECHNICAL_SPECIFICATION.md">📖 Docs</a>
</p>

---

## ✨ Overview

`@bymax-one/nest-storage` is the **what**; this repository is the **how**. It is a runnable,
production-shaped demo that exercises **every public export** of the library across a NestJS API and a
first-class Next.js storage dashboard. It is three things at once:

- **A runnable demo.** `pnpm infra:up` + `pnpm dev` brings up a MinIO object store and a NestJS service
  wired to the library, plus a Next.js dashboard that fires every storage feature on demand and shows the
  result: an upload switching to multipart, a presigned URL expiring, a file rejected with its threat name,
  a byte range streamed back.
- **A knowledge base.** Every public symbol is referenced from real code, and the coverage matrix is
  enforced by a CI export-usage audit (`scripts/audit-library-exports.mjs`): the canonical place to learn
  how to wire the canonical `forRootAsync`, presigned GET/PUT/multipart, the visible TTL clamp, the
  validation pipeline, the file-scanner seam, and app-level multi-tenant key isolation.
- **A copy-paste reference.** `apps/api/src/config/storage.config.ts` exercises every configuration block
  once, so adopting the library is a matter of lifting the wiring you need.

It is a sibling of [`nest-logger-example`](https://github.com/bymaxone/nest-logger-example) and
[`nest-cache-example`](https://github.com/bymaxone/nest-cache-example) and follows the same blueprint, voice,
and quality bar: **100% test coverage**, a **Stryker mutation gate (api 100 · web >= 90)**, English-only, and
Conventional Commits.

---

## 🚀 Quick start

```bash
git clone https://github.com/bymaxone/nest-storage-example.git
cd nest-storage-example

# 1) build the sibling library once (consumed pre-publish via a local file: link)
cd ../nest-storage && pnpm install && pnpm build
# then back to this repo:
cd ../nest-storage-example

# 2) install workspace deps (resolves the file: link)
pnpm install

# 3) bring up MinIO (three buckets, versioning on vault-versioned, seed objects)
pnpm infra:up

# 4) create the API env file
cp apps/api/.env.example apps/api/.env

# 5) start both apps
pnpm dev
```

| Surface                | URL                            |
| ---------------------- | ------------------------------ |
| Dashboard (`apps/web`) | <http://localhost:3000>        |
| API health             | <http://localhost:3001/health> |
| MinIO console          | <http://localhost:9001>        |

The library is **pre-publish**, consumed via a local `file:` link to the sibling `../nest-storage` checkout
until it ships to npm (build it first, step 1). The local happy path needs **zero external credentials**:
objects land in a local MinIO bucket, the scanner keys on inert demo markers, and the dev credentials
(`minioadmin`) are bound to the loopback interface only.

---

## 🔥 What's inside

- **Uploads:** single-shot, multipart with live `onProgress` sessions, streamed (known and unknown size,
  which forces multipart), idempotent, and per-call SSE override (`AES256` / `aws:kms` / `NONE`).
- **Downloads:** stream proxy, size-guarded buffer preview, byte range, and versioned retrieval from the
  versioned bucket.
- **Listing + lifecycle:** paged listing with folder aggregation, head/exists, idempotent + bulk delete with
  the library failure report, server-side copy + archive, and public URL construction.
- **Presigned URLs:** GET (with response overrides + the visible requested-vs-effective TTL clamp), PUT (with
  the advisory Content-Length policy), and multipart (part URLs + complete + abort), all treated as
  credentials: masked in the UI, never logged.
- **Direct upload + confirm:** the honest boundary. A presigned PUT bypasses server-side validation by
  design, mitigated by a mandatory confirm step (head + size/MIME re-check + the scanner seam).
- **Validation + scanner:** MIME whitelist (with wildcard), size cap, magic-byte forgery detection, and the
  inert `MarkerFileScanner` across both modes and both `rejectOnUnknown` values (never EICAR, never real
  malware).
- **Tenants + errors:** app-level tenant key isolation with a proof (A cannot read, list, or clear B), plus a
  deterministic explorer that reproduces every shipped `STORAGE_ERROR_CODES` value.
- **The dashboard (`apps/web`):** ten pages over a typed data layer keyed by `STORAGE_ERROR_CODES` from the
  `./shared` subpath, including real browser presigned PUT + confirm.
- **Quality bar:** 100% coverage on all four metrics for both apps, route-exhaustive e2e + Playwright
  journeys, and a Stryker mutation gate (api 100, web 96.58).

---

## 🏗️ Architecture

```
            apps/web (Next.js 16 + React 19): the Storage Dashboard
   Vault browser · Upload lab · Direct upload (real presigned PUT) · Signed URLs
   Validation + Scanner labs · Tenants · Error explorer · System introspection
        │  POST /uploads/* /signed/* /vault/* /validation/* /scanner/* /tenants/*     ▲ GET metadata / streams
        ▼                                                                             │
   ┌───────────────────────────────────────────────────────────────────────────────┴────────────┐
   │ apps/api (NestJS 11 + Express)                                                               │
   │ BymaxStorageModule.forRootAsync({ useFactory }): config/storage.config.ts (every block)      │
   │ StorageService · SignedUrlService · ConfirmService · MarkerFileScanner · StorageExceptionFilter │
   └────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                    S3 API (@aws-sdk/client-s3 v3, path-style)
                                                 ▼
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ MinIO (S3-compatible) object store: vault · vault-archive · vault-versioned    │
   │  server :9000 · console :9001 · dev creds minioadmin, bound to 127.0.0.1       │
   └─────────────────────────────────────────────────────────────────────────────┘
```

`apps/api` and `apps/web` are independently deployable; the same wiring targets any S3-compatible provider
(AWS S3, Cloudflare R2, MinIO) by swapping the endpoint and credentials.

> **Coverage rule.** Every public export of `@bymax-one/nest-storage` (the `.` and `./shared` subpaths) is
> referenced from at least one runtime file under `apps/`, enforced on CI by
> [`scripts/audit-library-exports.mjs`](scripts/audit-library-exports.mjs).

---

## 📖 Documentation

| Doc                                                        | What it covers                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| [TECHNICAL_SPECIFICATION](docs/TECHNICAL_SPECIFICATION.md) | Architecture, feature matrix, API wiring patterns, design decisions  |
| [DEVELOPMENT_PLAN](docs/DEVELOPMENT_PLAN.md)               | The phased build plan, progress dashboard, and quality gates         |
| [Task files](docs/tasks/)                                  | Per-phase task breakdowns with acceptance criteria                   |
| [GO_PUBLIC](docs/GO_PUBLIC.md)                             | The visibility-flip checklist and release-readiness notes            |
| [Stryker baseline](docs/stryker/BASELINE.md)               | Mutation scores, documented equivalents, and the CI enforcement note |

---

## 🧱 Tech Stack

<p>
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS 11" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript strict" />
  <img src="https://img.shields.io/badge/Node.js-24%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node 24+" />
  <img src="https://img.shields.io/badge/AWS%20SDK-v3-232F3E?style=flat-square&logo=amazonaws&logoColor=white" alt="AWS SDK v3" />
  <img src="https://img.shields.io/badge/MinIO%20%2F%20S3-compatible-C72E49?style=flat-square&logo=minio&logoColor=white" alt="MinIO / S3" />
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind 4" />
  <img src="https://img.shields.io/badge/pnpm-10-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm 10" />
  <img src="https://img.shields.io/badge/Docker-Compose%20v2-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker Compose v2" />
  <img src="https://img.shields.io/badge/Jest-30-C21325?style=flat-square&logo=jest&logoColor=white" alt="Jest 30" />
  <img src="https://img.shields.io/badge/Vitest-3-6E9F18?style=flat-square&logo=vitest&logoColor=white" alt="Vitest 3" />
  <img src="https://img.shields.io/badge/Testcontainers-MinIO-291A3F?style=flat-square" alt="Testcontainers MinIO" />
  <img src="https://img.shields.io/badge/Playwright-1-2EAD33?style=flat-square&logo=playwright&logoColor=white" alt="Playwright 1" />
  <img src="https://img.shields.io/badge/Stryker-mutation-E74C3C?style=flat-square" alt="Stryker mutation" />
</p>

| Layer             | Choice                              | Why                                                            |
| ----------------- | ----------------------------------- | -------------------------------------------------------------- |
| Storage           | `@bymax-one/nest-storage@^0.1.0`    | The library this repo demonstrates                             |
| Backend runtime   | Node.js >= 24                       | Library minimum; native streams and `node:crypto`              |
| Backend framework | NestJS 11 on Express                | Library peer dep                                               |
| Object store      | MinIO (S3-compatible)               | Zero-credential local S3; the same code targets AWS S3 / R2    |
| S3 client         | `@aws-sdk/client-s3` v3 + presigner | The library transport; path-style addressing against MinIO     |
| Frontend          | Next.js 16 App Router               | Library peer dep; consumes the `./shared` browser subpath only |
| UI                | React 19 + Tailwind 4 + shadcn/ui   | The verbatim Bymax design system (forced dark)                 |
| Tests (api)       | Jest 30 + supertest                 | Unit + e2e HTTP surface, 100% coverage                         |
| Tests (web unit)  | Vitest 3 (jsdom)                    | Fast ESM-first runner, 100% coverage                           |
| Tests (e2e)       | Testcontainers MinIO + Playwright   | Real-fetch presigned round-trips + live browser journeys       |
| Mutation          | Stryker 9                           | `break` gate: api 100, web >= 90 (`lib/**` 100)                |
| Container runtime | Docker Compose v2                   | Single-command local + ephemeral test stacks                   |
| Package manager   | pnpm 10                             | Matches the library; first-class workspace support             |

---

## 🤝 Contributing

Issues and PRs are welcome. Because this is a reference application, the bar for changes is:

> _"Does this make the demonstration of `@bymax-one/nest-storage` clearer or more complete?"_

Generic refactors that obscure library usage will be declined. See [CONTRIBUTING.md](CONTRIBUTING.md) for the
full process.

```bash
# Clone
git clone https://github.com/bymaxone/nest-storage-example.git
cd nest-storage-example

# Install (build the sibling ../nest-storage first, see Quick start)
pnpm install

# Verify
pnpm typecheck && pnpm lint && pnpm format:check && pnpm --filter @nest-storage-example/api run test:cov

# Run
pnpm infra:up && pnpm dev
```

---

## 🔒 Security policy

If you find a security vulnerability, in **either this example or the library**, please **do not** open a
public issue, discussion, or pull request. Email **support@bymax.one** with `[security] nest-storage-example`
in the subject line. A vulnerability in the **library itself** (`@bymax-one/nest-storage`) should be reported
against [its repository](https://github.com/bymaxone/nest-storage).

Presigned URLs are credentials and per-tenant objects must never leak across tenants; we triage security
reports ahead of feature work. See [SECURITY.md](SECURITY.md) for the full disclosure process.

---

## 📄 License

[MIT](LICENSE) © [Bymax One](https://bymax.one)

Library source: [`@bymax-one/nest-storage`](https://github.com/bymaxone/nest-storage), MIT.

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/bymaxone">Bymax One</a> to demonstrate <a href="https://github.com/bymaxone/nest-storage">@bymax-one/nest-storage</a>.</sub>
</p>
