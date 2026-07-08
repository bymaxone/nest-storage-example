# Stryker Mutation History

> Append-only run log. Newest entry on top. Each entry records the date, both apps' scores, the
> survivor count, and what changed. See [`BASELINE.md`](./BASELINE.md) for the current baseline and
> the equivalent-mutant inventory.

## 2026-07-07 — baseline established

- `apps/api`: **100.00** (break 100), 0 survivors. 742 killed, 4 timeout, 2 documented equivalents
  (Ignored via inline `Stryker disable`). Compile-only mutants are skipped by the TypeScript checker.
- `apps/web`: **96.58** (break 90), 32 survivors. 901 killed, 4 timeout; `lib/**` fully killed. The
  survivors are genuine equivalents in the presentational `components/**` layer.
- Suites strengthened so every previously-surviving killable mutant now fails a behavioral assertion;
  the only suppressions are the equivalents recorded in the baseline.
