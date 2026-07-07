# nest-storage-example

> Status: under active development. The API skeleton, upload pipeline, and dashboard are being
> built incrementally. See [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) for the current
> phase status.

The canonical reference application for
[`@bymax-one/nest-storage`](https://github.com/bymaxone/nest-storage), a provider-agnostic S3
object-storage library for NestJS. This project exercises every public feature of the library in a
coherent, runnable scenario: a document vault backed by MinIO, with a NestJS 11 API demonstrating
single-shot and multipart uploads, presigned URLs, validation pipelines, a file-scanner hook, and
multi-tenant key-prefix isolation. A Next.js 16 dashboard makes the invisible parts visible: watch
an upload switch to multipart, see a signed URL expire, and observe a file rejected with its
threat name.

It doubles as the library's dogfooding harness and as a copy-paste reference for any project
adopting `@bymax-one/nest-storage`.

## Documentation

| Document                                                   | Description                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Technical Specification](docs/TECHNICAL_SPECIFICATION.md) | Architecture, feature matrix, API wiring patterns, and all design decisions |
| [Development Plan](docs/DEVELOPMENT_PLAN.md)               | Phased roadmap, progress dashboard, and quality gates                       |
| [Task Files](docs/tasks/)                                  | Per-phase task breakdowns with acceptance criteria                          |

## Quick Start

> Full setup requires Docker (for MinIO) and Node >= 24. This section will be expanded when the
> infrastructure and application phases land.

```sh
# Start MinIO (three buckets, versioning enabled on vault-versioned)
pnpm infra:up

# Start the API (port 3001) and web dashboard (port 3000)
pnpm dev
```

## Stack

- **Backend:** NestJS 11, TypeScript 5.9 strict, Zod
- **Frontend:** Next.js 16, React 19, Tailwind v4, shadcn new-york
- **Storage:** MinIO (S3-compatible, local Docker)
- **Tooling:** pnpm workspaces, ESLint 9 flat, Prettier 3, husky + commitlint

## License

MIT - see [LICENSE](LICENSE).
