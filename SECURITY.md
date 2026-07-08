# Security Policy

`nest-storage-example` is the public reference application for `@bymax-one/nest-storage`. It handles material
that must never leak: presigned URLs (which are temporary credentials), per-tenant objects, and dev
credentials. We triage security reports ahead of feature work.

## Supported versions

This repository tracks one library minor at a time (see [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md)).
Security fixes land on the tip of the default branch; there are no long-lived release branches to back-port
to.

| Branch / version       | Status                          |
| ---------------------- | ------------------------------- |
| `main` (current minor) | Active, receives security fixes |
| Older tags / forks     | Best effort only                |

A vulnerability in the **library itself** (`@bymax-one/nest-storage`) should be reported against
[its repository](https://github.com/bymaxone/nest-storage), not here. Report it here only if it is
reproducible through this example's own demo code.

## Reporting a vulnerability

**Do not report security issues through public GitHub Issues, Discussions, or pull requests.** Public reports
give attackers a window between disclosure and fix.

Email **support@bymax.one** with `[security] nest-storage-example` in the subject line. If you prefer, you may
instead open a GitHub
[private security advisory](https://github.com/bymaxone/nest-storage-example/security/advisories/new).

### What to include

- A clear description of the vulnerability and its impact.
- Step-by-step reproduction against the default branch.
- The affected surface (an API route, the dashboard, the build/CI, a dependency).
- A suggested fix or mitigation, if you have one.
- Whether you would like to be credited (and how).

## Scope notes

- **Dev credentials only.** The local stack uses the well-known `minioadmin` MinIO credentials bound to the
  loopback interface; these are demo values, not a finding.
- **Presigned URLs are credentials.** Reports about a signed URL being logged, snapshotted, cached across
  users, or rendered unmasked are in scope.
- **Tenant isolation** is app-level key-prefix composition; a report that clearing or listing one tenant can
  reach another tenant's objects is in scope.
- **Inert scanner fixtures.** The demo scanner keys on the text markers `X-DEMO-INFECTED` / `X-DEMO-UNKNOWN`
  only; please never attach real malware or the EICAR test string to a report.

We aim to acknowledge a report within a few business days and to keep you updated through resolution.
