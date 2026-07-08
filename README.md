<h1 align="center">nest-storage-example</h1>

<p align="center">
  The canonical reference application for <a href="https://github.com/bymaxone/nest-storage"><code>@bymax-one/nest-storage</code></a> —
  a provider-agnostic S3 object-storage library exercised end to end across a NestJS 11 API and a Next.js 16 dashboard.
</p>

<p align="center">
  <img alt="library" src="https://img.shields.io/badge/%40bymax--one%2Fnest--storage-%5E0.1.0-6E56CF" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-green" />
  <img alt="typescript" src="https://img.shields.io/badge/TypeScript-strict-3178C6" />
  <img alt="node" src="https://img.shields.io/badge/Node-%3E%3D24-339933" />
  <img alt="nestjs" src="https://img.shields.io/badge/NestJS-11-E0234E" />
  <img alt="next" src="https://img.shields.io/badge/Next.js-16-000000" />
  <img alt="react" src="https://img.shields.io/badge/React-19-61DAFB" />
  <img alt="tailwind" src="https://img.shields.io/badge/Tailwind-4-06B6D4" />
  <img alt="storage" src="https://img.shields.io/badge/Amazon%20S3%20%2F%20MinIO-S3--compatible-569A31" />
  <img alt="aws-sdk" src="https://img.shields.io/badge/AWS--SDK-v3-232F3E" />
  <img alt="testcontainers" src="https://img.shields.io/badge/Testcontainers-e2e-291A54" />
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
production-shaped demo that exercises **every public export** of the library across a NestJS API and
a first-class Next.js dashboard, all wired to a local MinIO stack (three buckets: `vault`,
`vault-archive`, `vault-versioned`). Uploads switch to multipart before your eyes, signed URLs count
down to expiry, an infected marker is rejected with its threat name, and every one of the 17 storage
error codes is reproducible on demand.

### 🚀 Quick start

```bash
git clone https://github.com/bymaxone/nest-storage-example.git
cd nest-storage-example
pnpm install && pnpm infra:up
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm dev
```

The API comes up on port 3001 and the dashboard on port 3000. `pnpm infra:up` boots MinIO and seeds
the three buckets (versioning enabled on `vault-versioned`).

> The library is **pre-publish** — it is consumed via a local `file:` link to the sibling
> `../nest-storage` checkout until it ships to npm. Build that checkout first (`pnpm install && pnpm build`
> inside it); once the library is on npm the dependency becomes a `^0.1.0` range and the link step drops away.

---

## 🔥 What's inside

**Uploads**

- ✅ Single-shot, multipart (auto-threshold), and streaming uploads with live SSE progress
- ✅ Idempotent uploads served from the idempotency cache on replay

**Downloads**

- ✅ Streamed and buffered downloads, HTTP range requests, and versioned reads on `vault-versioned`

**Listing and lifecycle**

- ✅ Prefix/folder listing with pagination, `head`/`exists`, `delete`/`deleteMany`, and `copy`

**Signed URLs and direct upload**

- ✅ Presigned GET/PUT and multipart URLs with TTL clamping, plus browser direct-upload → confirm

**Validation and scanning**

- ✅ MIME / size / magic-byte validators and a marker scanner (pre/post modes, `rejectOnUnknown`)

**Tenants and errors**

- ✅ Key-prefix tenant isolation and the 17-code error explorer, each code reproducible on demand

**The dashboard (`apps/web`)**

- ✅ Vault browser, Upload lab, Direct upload, Signed URLs, Validation, Scanner, Tenants, System pages

**Quality bar**

- ✅ 100% unit coverage across all four metrics on both apps (api + web)
- ✅ Route-exhaustive API e2e (Testcontainers MinIO) + Playwright dashboard journeys
- ✅ Stryker mutation: api **100.00** (`break: 100`, 0 survivors) · web **96.58** (`break: 90`)
- ✅ English-only, Conventional Commits, no suppressions

---

## 🏗️ Architecture

```
   apps/web (Next.js 16 + React 19 + Tailwind 4)
   Vault · Upload lab · Direct upload · Signed URLs · Validation · Scanner · Tenants · System
        │ REST + SSE
        ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ apps/api (NestJS 11)                                              │
   │ BymaxStorageModule.forRootAsync — services, validators, scanner, │
   │ signed URLs, tenant prefixes, the global storage exception filter │
   └───────────────────────────────┬──────────────────────────────────┘
                                    │ AWS-SDK v3 (S3 API)
                                    ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ MinIO (S3-compatible)                                            │
   │ vault  ·  vault-archive  ·  vault-versioned (versioning enabled) │
   └──────────────────────────────────────────────────────────────────┘
```

`apps/api` and `apps/web` are independently deployable; the dashboard imports only the browser-safe
`/shared` subpath (types and constants), never the NestJS/AWS server entry.

> **Coverage rule.** Every public export of `@bymax-one/nest-storage` (the `.` and `/shared`
> subpaths) is referenced from at least one file under `apps/`, enforced in CI by
> **[`scripts/audit-library-exports.mjs`](scripts/audit-library-exports.mjs)** — an unreferenced
> export fails the build.

---

## 📖 Documentation

| Doc                                                        | What it covers                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| [Technical Specification](docs/TECHNICAL_SPECIFICATION.md) | Architecture, feature matrix, API wiring patterns, decisions   |
| [Development Plan](docs/DEVELOPMENT_PLAN.md)               | Phased roadmap, progress dashboard, and quality gates          |
| [Task Files](docs/tasks/)                                  | Per-phase task breakdowns with acceptance criteria             |
| [Go Public Checklist](docs/GO_PUBLIC.md)                   | Flipping the repo public and activating the security workflows |
| [Stryker Baseline](docs/stryker/BASELINE.md)               | Mutation scores and the documented equivalent-mutant inventory |

---

## License

MIT © Bymax One. `@bymax-one/nest-storage` is MIT © Bymax One. See [LICENSE](LICENSE).
