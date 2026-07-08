# Contributing to nest-storage-example

Thanks for your interest. This repository is the canonical reference application for
`@bymax-one/nest-storage`, so contributions are judged by how well they demonstrate the library, not by
generic code churn.

## Reporting security issues

Please do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md) for the private
disclosure process (`support@bymax.one`).

## The bar for a change

> _"Does this make the demonstration of `@bymax-one/nest-storage` clearer or more complete?"_

Changes that clarify a library feature, add a missing demonstration, fix a bug, or improve the docs are
welcome. Generic refactors that obscure how the library is wired will be declined.

## Prerequisites

- Node.js >= 24 and pnpm 10 (`corepack enable`).
- Docker (Docker Compose v2) for the local MinIO stack and the Testcontainers e2e suites.

## Getting started

```bash
# Clone + build the sibling library first (consumed pre-publish via file:, must be built before pnpm install)
git clone https://github.com/bymaxone/nest-storage.git ../nest-storage
cd ../nest-storage && pnpm install && pnpm build
cd ../nest-storage-example

# Install the workspace (resolves the file: link)
pnpm install

# Bring up MinIO (three buckets, versioning, seed objects)
pnpm infra:up
```

## Verification, run before every PR

```bash
pnpm lint
pnpm typecheck
pnpm format:check
pnpm --filter @nest-storage-example/api run test:cov   # 100% on all four metrics
pnpm --filter web test:cov                              # 100% on all four metrics
pnpm --filter @nest-storage-example/api run test:e2e    # real MinIO via Testcontainers
node scripts/audit-library-exports.mjs                  # every library export is demonstrated
```

The mutation gate (Stryker, api break 100 / web break 90) is authoritative locally and pre-release:
`pnpm mutation`. It runs advisory on CI (post-merge) because both apps exceed the hosted-runner window; see
[docs/stryker/BASELINE.md](docs/stryker/BASELINE.md).

## Commits, Conventional Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`,
enforced locally by commitlint. Use the scopes in `.gitmessage`. Do not add any AI-attribution or
`Co-Authored-By` trailer.

## Pull requests

- Keep the working tree at 100% coverage on both apps; every `it()` carries a scenario comment.
- No suppression comments (`@ts-ignore`, `eslint-disable`, `istanbul ignore`); remove dead branches instead.
- English only; no em dashes in code or docs.
- CI must be green (lint, typecheck, format, unit, e2e, web build, Playwright, export-usage audit).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
