# Stryker Mutation Baseline

> Mutation testing is the assertiveness gate layered on top of 100% line/branch coverage: it proves
> the suites fail when behavior changes, not merely that lines were executed. Both apps are mutated
> after unit coverage and e2e are green. Reports are regenerated locally and in CI (`pnpm mutation`);
> the HTML/JSON artifacts under each app's `reports/mutation/` are gitignored.

## Scores

| App        | Runner | Mutate scope                               | Thresholds (high/low/break) | Score      | Survivors |
| ---------- | ------ | ------------------------------------------ | --------------------------- | ---------- | --------- |
| `apps/api` | jest   | `src/**` minus modules / dto / main / d.ts | 100 / 100 / 100             | **100.00** | 0         |
| `apps/web` | vitest | `lib/**` + `components/**` + `hooks/**`    | 100 / 95 / 90               | **96.58**  | 32        |

`apps/api` runs at `break: 100` with zero survivors: every mutant is Killed, Timed-out, or a
documented equivalent (Ignored via an inline `Stryker disable`). `apps/web` runs at `break: 90`;
`lib/**` is held to 100, and the residual survivors in `components/**` are genuine equivalent
mutants (see below) rather than assertion gaps.

## `apps/api` — documented equivalent mutants (2)

Each equivalent is suppressed with an inline `// Stryker disable next-line <Mutator>: <reason>`
comment at the mutation site. These are the only suppressions; no killable mutant is disabled.

| File                             | Mutator       | Why it is a genuine equivalent                                                                                                                                      |
| -------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/config/env.schema.ts`       | StringLiteral | The env schema is flat: every Zod issue path is a single segment or empty, so the `.join('.')` separator is never applied between two segments and is unobservable. |
| `src/uploads/uploads.service.ts` | StringLiteral | The `'stream'` fallback filename has no extension and is consumed only by `extractExtension`; an empty fallback yields the identical extension-less key.            |

## `apps/web` — residual survivors (32)

`apps/web` clears `break: 90` at 96.58 with `lib/**` fully killed. The 32 surviving mutants live in
the presentational `components/**` layer and are genuine equivalents: static-class-string and
style-attribute mutations with no behavioral observable, and timing formulae whose result is
immediately recomputed on the next render. `ignoreStatic: true` removes most of them; the remainder
are left visible (not individually suppressed) so a real regression in that layer still surfaces.

One representative equivalent is suppressed inline where it is provably unobservable:

| File                                   | Mutator                                       | Why it is a genuine equivalent                                                                                                                   |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/transfer/TtlCountdown.tsx` | ArrowFunction / MethodExpression / Arithmetic | The mount effect immediately recomputes `remaining` with the identical formula, so the lazy initializer's value is never observed by any render. |

## Running it

```bash
pnpm mutation                 # both apps, serialized (workspace-concurrency=1)
pnpm --filter api run mutation
pnpm --filter web run mutation
```

Each app's Stryker config caps `concurrency` at 2 so a run stays memory-safe on a 2-core CI runner,
and the two apps never mutate concurrently.

## CI enforcement note

The mutation thresholds (api `break: 100`, web `break: 90`) are the authoritative,
blocking gate **locally and pre-release** via the committed Stryker configs
(`pnpm mutation`). On CI the `Mutation testing` job runs only on push to `main`
(post-merge) and is advisory (`continue-on-error: true`): mutating both apps takes
longer than a two-core hosted runner completes inside a reasonable pull-request
window, so it does not gate PRs. Coverage (100% on all four metrics for both apps),
the route-exhaustive e2e, the Playwright journeys, and the export-usage audit remain
blocking on every PR.
