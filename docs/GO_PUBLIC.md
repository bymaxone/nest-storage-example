# Go Public Checklist

> The steps to flip `nest-storage-example` from private to public and activate the
> visibility-gated security workflows. This example ships as a **repository**, not an npm package:
> there is **no npm publish** and **no version tag**. Consumers clone it and run it.

## Before flipping

- [ ] `main` is green on the full CI matrix (lint, typecheck, format, unit x2, e2e, Playwright,
      export audit, mutation).
- [ ] The repository metadata (description, homepage `https://bymax.one`, topics) is set. It already
      is; do not change it as part of the flip.
- [ ] `LICENSE` (MIT) is present and the README license section is accurate.
- [ ] No secrets in history: only dev credentials (MinIO `minioadmin`) appear, and the secret scan is
      clean.

## The flip (operator action)

The visibility change is an operator-confirmed action; run it when the above is satisfied:

```bash
gh repo edit bymaxone/nest-storage-example --visibility public --accept-visibility-change-consequences
```

## What activates on the flip

Two workflows stay dormant while the repo is private and begin running once it is public:

- **CodeQL** (`.github/workflows/codeql.yml`); a caller of the org's reusable analysis in
  `bymaxone/.github`, which resolves the repository's visibility through the API rather than the event
  payload, so the gate also holds on the weekly run. It uses `github/codeql-action`, which is
  GitHub-owned and permitted by the org Actions policy, and activates cleanly on the flip. Its
  `Repository visibility` job runs in both states; only the analysis waits for public.
- **OpenSSF Scorecard** (`.github/workflows/scorecard.yml`); publishes supply-chain posture to the
  Security tab.

## ⚠️ Operator action item; Scorecard is a third-party action

`scorecard.yml` uses **`ossf/scorecard-action`**, which is a **third-party** action. This org's
GitHub Actions policy currently permits **only GitHub-owned and verified actions** (the
`patterns_allowed` allowlist is empty), so on the public flip the Scorecard workflow will be
**blocked** from running until an operator does one of the following:

1. **Allowlist it.** Add `ossf/scorecard-action@*` to the allowed-actions patterns in the
   organization (or repository) Actions settings; `Settings → Actions → General → Allowed actions`,
   or via the org policy API. `ossf/scorecard-action` is a well-known OpenSSF action, but it is still
   third-party, so it must be explicitly allowed.
2. **Or adapt/remove the workflow.** Drop `scorecard.yml` (or replace the Scorecard step with a
   GitHub-owned equivalent) if allowlisting is not desired.

Do **not** change the org Actions policy as part of routine work; surface this to the operator who
owns org settings. CodeQL is unaffected because `github/codeql-action` is GitHub-owned.

## After flipping

- [ ] Confirm CodeQL ran and populated the Security tab.
- [ ] Confirm Scorecard either ran (allowlisted) or is intentionally deferred/removed per the item
      above.
- [ ] Confirm the README shields render on the public page.

## Not part of the flip

- **No npm publish.** The example is not published to a registry.
- **No version tag.** There is no release tag; branches track the linked library commit pinned in
  `.github/actions/setup`.
- **The `file:` link.** Until `@bymax-one/nest-storage` publishes to npm, the apps consume it via the
  local `file:../../../nest-storage` link; the swap to a `^0.1.0` range is pending that publish.
