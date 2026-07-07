# Phase 8: web-dashboard

> **Status**: 📋 ToDo · **Progress**: 0 / 6 tasks · **Last updated**: 2026-07-06
> **Source roadmap**: [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) §5 (P8)
> **Source spec**: [`../TECHNICAL_SPECIFICATION.md`](../TECHNICAL_SPECIFICATION.md) §13, §14, §17

## Context

The backend surface is complete (P2-P7). This phase delivers the Next.js 16 dashboard, visually
indistinguishable from the sibling Bymax reference apps: the verbatim design system, the shell,
the typed data layer keyed by `STORAGE_ERROR_CODES` from `./shared`, and the ten pages of spec
§13.2, including the direct-upload page performing real presigned PUTs from the browser.

## Rules-of-phase

1. The four design-system files are copied **verbatim** from a sibling `apps/web`
   (`app/globals.css`, `tailwind.config.ts`, `components.json`, `postcss.config.mjs`); the
   acceptance bar is chrome indistinguishability (spec §14).
2. The browser bundle imports only `@bymax-one/nest-storage/shared`; no NestJS/SDK code ships to
   the client.
3. Signed URLs are treated as credentials in the UI: masked when rendered, never logged.
4. Every page renders real backend state; no mocked data ships in the final build.

## Reference docs

- `../TECHNICAL_SPECIFICATION.md` §13 (pages + data layer), §14 (design system), §17 (direct upload)
- `../design_system.html`; a sibling reference app's `apps/web` for the verbatim files

## Task index

| ID  | Task                                                       | Status  | Priority | Size | Depends on |
| --- | ---------------------------------------------------------- | ------- | -------- | ---- | ---------- |
| 8.1 | Branch + Next skeleton + verbatim design system + shell    | 📋 ToDo | P0       | L    | none       |
| 8.2 | Typed data layer: api-client, error union, query hooks     | 📋 ToDo | P0       | M    | 8.1        |
| 8.3 | Vault browser + detail drawer + lifecycle actions          | 📋 ToDo | P0       | L    | 8.2        |
| 8.4 | Upload lab + direct upload + signed URLs pages             | 📋 ToDo | P0       | L    | 8.2        |
| 8.5 | Labs + tenants + errors + system pages                     | 📋 ToDo | P0       | M    | 8.2        |
| 8.6 | Phase close: audit, dashboards, PR + Copilot review, merge | 📋 ToDo | P0       | S    | 8.1-8.5    |

## Tasks

### Task 8.1: Branch + skeleton + design system + shell

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: none

#### Description

Next.js 16 + React 19 + Tailwind v4 + shadcn `new-york` app with the verbatim design-system files,
Geist fonts, forced dark mode, and the standard shell (64 px topbar, 250 px grouped sidebar, orange
active state, `nest-storage-example` wordmark).

#### Acceptance criteria

- [ ] Branch `feat/phase-08-web-dashboard` created with `git switch -c`.
- [ ] The four design-system files are byte-identical to the sibling source (diff-verified) except `components.json` path adjustments if strictly required (documented).
- [ ] Shell renders: topbar, sidebar groups (Vault / Transfer / Labs / System), status chip polling `/health`, dark theme, brand wordmark.
- [ ] shadcn primitives scaffolded (button, card, badge, input, select, table, tabs, tooltip, dialog, dropdown-menu, scroll-area, skeleton, sonner).
- [ ] `pnpm --filter web build` succeeds.

#### Files to create / modify

- `apps/web/app/*`, `apps/web/components/layout/*`, design-system files, `apps/web/package.json`

#### Agent prompt

```
You are a senior frontend engineer replicating a shared design system.

PROJECT: nest-storage-example. The dashboard must be visually indistinguishable from the sibling
Bymax reference apps (nest-auth-example / nest-logger-example / nest-cache-example): same tokens,
fonts, shell, glass-morphism. docs/design_system.html documents the system; the four files are
copied VERBATIM from a sibling apps/web.

CURRENT PHASE: 8 (web-dashboard), Task 8.1 of 6 (FIRST).

PRECONDITIONS
- Phase 7 merged: the backend surface is complete; apps/web exists as a stub with the shared-subpath probe.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §13.2 (pages list for the sidebar), §14 (design system + the four files)
- docs/design_system.html (tokens/shell reference)
- Next.js 16 official docs for app-router setup (verify current APIs)

TASK
Create the branch and the dashboard skeleton: Next 16 app, verbatim design system, shell, status
chip; build green.

DELIVERABLES
1. `git switch -c feat/phase-08-web-dashboard` (NEVER `git checkout -b`).
2. Next.js 16 + React 19 + Tailwind v4 + shadcn new-york wiring in apps/web; copy
   app/globals.css, tailwind.config.ts, components.json, postcss.config.mjs verbatim from the
   sibling repository layout documented in §14 (obtain via the public sibling repo; record the
   source commit in the PR body).
3. app/layout.tsx: Geist Sans/Mono, forced dark on <html>, Providers (TanStack Query, NuqsAdapter,
   Sonner Toaster).
4. components/layout/: Topbar (64px, wordmark nest-storage-example, status chip), Sidebar (250px,
   groups: Vault [/, /vault], Transfer [/upload, /direct, /signed], Labs [/validation, /scanner,
   /tenants, /errors], System [/system]), AppShell.
5. shadcn primitives listed in the acceptance criteria.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Design files verbatim (diff against source); TS strict; English only; timeless comments.
- Conventional Commit: `feat(web): dashboard skeleton with the shared design system (8.1)`.

Verification:
- `pnpm --filter web build` exits 0.
- `diff` of each copied design file against its recorded source shows no drift (or the documented
  path-only adjustment).

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/6).
2. Update the P8 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 8.1 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 8.2: Typed data layer

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 8.1

#### Description

`lib/api-client.ts` (typed fetch, error union keyed by `STORAGE_ERROR_CODES` from `./shared`),
TanStack Query hooks per backend area, `nuqs` URL state helpers, and the direct-PUT helper honoring
`requiredHeaders`.

#### Acceptance criteria

- [ ] The error union narrows on `error.code` across all 17 codes; unknown responses map to a typed fallback.
- [ ] Query hooks exist for vault, uploads, signed, validation, scanner, tenants, errors, system.
- [ ] `lib/direct-upload.ts`: PUT with exactly the issued `requiredHeaders`, progress callback, and multipart split/complete/abort helpers.
- [ ] Vitest unit tests for the client, the union narrowing, and the direct-upload helpers (fetch mocked) at 100% on `lib/**`.

#### Files to create / modify

- `apps/web/lib/api-client.ts`, `lib/direct-upload.ts`, `lib/storage-status.ts`, `hooks/*`, tests

#### Agent prompt

```
You are a senior frontend engineer building a typed API layer.

PROJECT: nest-storage-example. The backend returns library envelopes { error: { code, message,
details } } with codes from STORAGE_ERROR_CODES (imported from '@bymax-one/nest-storage/shared',
the zero-dep subpath, the ONLY library import allowed in the browser).

CURRENT PHASE: 8, Task 8.2 of 6 (MIDDLE).

PRECONDITIONS
- Task 8.1 done on branch feat/phase-08-web-dashboard.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §13.1, §17 (direct-upload flow)
- The backend controllers' response shapes (read the api source for the routes you type)

TASK
Implement the typed client, hooks, and direct-upload helpers; Vitest to 100% on lib/**.

DELIVERABLES
1. lib/api-client.ts: base fetch with JSON handling; ApiError discriminated union keyed by the 17
   codes + a typed UNKNOWN fallback; helpers get/post/del typed per route family.
2. lib/direct-upload.ts: putWithHeaders(url, requiredHeaders, body, onProgress) using
   XMLHttpRequest for progress; multipart helpers splitting a File by part size, PUT-ing each part
   URL, then POST-ing complete/abort through the api client. Never log full URLs; mask query
   strings in any thrown message.
3. lib/storage-status.ts: status -> color/icon/label mapping for chips and verdict cards.
4. hooks/: TanStack Query wrappers per area with sensible keys; nuqs helpers for vault path state.
5. Vitest setup (jsdom) + tests: union narrowing per code, masked errors, direct-upload header
   fidelity and part math; 100% on lib/**.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Only the /shared subpath from the library in this app. TS strict; timeless comments.
- Conventional Commit: `feat(web): typed api client and direct-upload helpers (8.2)`.

Verification:
- `pnpm --filter web test` green with 100% on lib/**.
- `grep -rn "from '@bymax-one/nest-storage'" apps/web/ | grep -v /shared` returns nothing.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/6).
2. Update the P8 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 8.2 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 8.3: Vault browser

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 8.2

#### Description

The `/vault` page: folder breadcrumbs (delimiter navigation), virtualized object table with
cursor pagination, the detail drawer (Metadata / Preview / Range hex / URLs tabs), and the
lifecycle actions (delete, bulk delete with failure rendering, copy-to-archive), plus the `/`
overview page.

#### Acceptance criteria

- [ ] Folder navigation drives `delimiter='/'` + prefix state in the URL (nuqs); pagination via `nextCursor`.
- [ ] Detail drawer tabs: metadata (full `ObjectMetadata`), image preview (buffer route, size-guarded), hex panel (range route), URLs (public + CDN + signed GET issue with countdown).
- [ ] Actions: single delete (warned flag toast), bulk delete (partial-failure table), copy (same/archive with `deleteSource`).
- [ ] Overview page: bucket stats, config summary (redacted), quick actions, recent uploads.
- [ ] Component tests for the signature pieces (FolderBreadcrumbs, HexPreview, failure table).

#### Files to create / modify

- `apps/web/app/page.tsx`, `app/vault/page.tsx`, `components/vault/*`, tests

#### Agent prompt

```
You are a senior frontend engineer building a file-management UI.

PROJECT: nest-storage-example. The vault API provides list (prefix/delimiter/cursor), head,
preview, range, public-url, delete, bulk-delete, copy. The UI must make pagination, folders, and
partial failures visible and honest.

CURRENT PHASE: 8, Task 8.3 of 6 (MIDDLE).

PRECONDITIONS
- Task 8.2 done: hooks + client exist.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §13.2 (/ and /vault rows), §13.3 (FolderBreadcrumbs, HexPreview)
- The vault controller response shapes (read the api source)

TASK
Build the overview and vault pages with the drawer and lifecycle actions; component-test the
signature pieces.

DELIVERABLES
1. app/vault/page.tsx: breadcrumbs from prefix segments; TanStack Table + Virtual for the object
   list; cursor pagination controls; row click opens KeyDetailDrawer.
2. components/vault/KeyDetailDrawer.tsx: four tabs per the acceptance criteria; signed-GET issue
   renders a TtlCountdown ring and masks the URL (copy button copies the full value without
   rendering it).
3. Actions wired to the hooks with Sonner toasts; bulk-delete failure table renders { failed }
   rows verbatim.
4. app/page.tsx overview per spec §13.2.
5. Vitest component tests: breadcrumbs navigation, hex rendering from base64, failure table.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Design-system components only (no ad-hoc styles outside the tokens). TS strict; timeless comments.
- Conventional Commit: `feat(web): vault browser with detail drawer and lifecycle actions (8.3)`.

Verification:
- `pnpm --filter web build` green; `pnpm --filter web test` green.
- Manual: folder click narrows the listing; a bulk delete with one bogus key shows the failure row.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/6).
2. Update the P8 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 8.3 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 8.4: Transfer pages

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: L
- **Depends on**: 8.2

#### Description

`/upload` (strategy indicator, progress bars, idempotency card, SSE selector), `/direct` (real
presigned PUT + multipart from the browser, required-headers inspector, confirm step), and
`/signed` (GET link generator with the TTL clamp visualization).

#### Acceptance criteria

- [ ] Upload lab: drag-and-drop; the strategy chip reflects `UploadResult.multipart`; the progress bar streams session snapshots; the idempotency card shows the cache flip; the SSE selector round-trips.
- [ ] Direct page: full flow issue → PUT (progress) → confirm, with the required-headers inspector and the honest "local validation bypassed" banner; multipart variant with part progress and abort.
- [ ] Signed page: requested vs effective TTL side by side, countdown ring, expired-link refetch demo, `ttl=0` envelope rendering.
- [ ] Component tests for UploadDropzone strategy/progress logic and the TTL comparison.

#### Files to create / modify

- `app/upload/page.tsx`, `app/direct/page.tsx`, `app/signed/page.tsx`, `components/transfer/*`, tests

#### Agent prompt

```
You are a senior frontend engineer building upload experiences.

PROJECT: nest-storage-example. Three pages: server-side upload lab (strategy + progress sessions),
direct browser upload via presigned URLs (the library's flagship flow), and the signed-URL
generator with visible TTL clamping.

CURRENT PHASE: 8, Task 8.4 of 6 (MIDDLE).

PRECONDITIONS
- Task 8.2 done (direct-upload helpers exist).

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §12.2-§12.5, §13.2 (the three page rows), §17
- The uploads/signed controller shapes (read the api source)

TASK
Build /upload, /direct and /signed with the honesty banners and progress UX; component-test the
signature logic.

DELIVERABLES
1. app/upload/page.tsx + components/transfer/UploadDropzone.tsx: file drop, category select,
   optional header overrides, SSE selector; posts to the api; strategy chip + progress bar from
   GET /uploads/sessions/:id polling while active; idempotency card issuing the same key twice.
2. app/direct/page.tsx: issue upload-url; RequiredHeadersInspector table; XHR PUT progress;
   confirm step rendering metadata + scan verdict; multipart mode splitting the file with per-part
   progress and an abort button; the validation-bypass banner quoting the documented mitigation.
3. app/signed/page.tsx: GET link form (ttl, disposition override); requested vs effective TTL;
   TtlCountdown; refetch-after-expiry demo; ttl=0 envelope panel.
4. Vitest: dropzone strategy mapping, TTL comparison component, headers inspector rendering.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- URLs masked in the UI; copy-to-clipboard only. TS strict; timeless comments.
- Conventional Commit: `feat(web): upload, direct-upload and signed-url pages (8.4)`.

Verification:
- `pnpm --filter web build` + `test` green.
- Manual against the stack: a 12 MiB drop shows multipart + part progress; the direct flow
  completes issue -> PUT -> confirm.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/6).
2. Update the P8 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 8.4 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 8.5: Labs, tenants, errors, system pages

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: M
- **Depends on**: 8.2

#### Description

`/validation` (rules matrix + forgery demo), `/scanner` (verdict cards + mode/rejectOnUnknown
views + removal proof), `/tenants` (switcher + isolation proof), `/errors` (17-code explorer with
the envelope panel), `/system` (health, redacted config, recipes with quirks, versioning,
checksum demo).

#### Acceptance criteria

- [ ] Validation page renders the live rules from `/validation/rules` and drives the three failure paths with envelope panels.
- [ ] Scanner page: VerdictCard per outcome; post-upload removal proof rendered (`existsAfter: false`); config view.
- [ ] Tenants page: switcher, per-tenant listing, clear-one-prove-other flow with before/after counts.
- [ ] Errors page: catalogue table from `GET /errors`, trigger buttons, EnvelopePanel typed by the shared codes.
- [ ] System page: health, config introspection, six recipes with quirk chips, versioning table, checksum side-by-side demo.
- [ ] Component tests for VerdictCard and EnvelopePanel.

#### Files to create / modify

- `app/validation|scanner|tenants|errors|system/page.tsx`, `components/labs/*`, tests

#### Agent prompt

```
You are a senior frontend engineer completing a reference dashboard.

PROJECT: nest-storage-example. Five pages exposing the labs, tenants, the exhaustive error
explorer, and system introspection; everything typed by the shared error codes.

CURRENT PHASE: 8, Task 8.5 of 6 (MIDDLE).

PRECONDITIONS
- Task 8.2 done; backend routes live.

REQUIRED READING (only these)
- docs/TECHNICAL_SPECIFICATION.md §13.2 (the five page rows), §12.6-§12.8, §16, §18
- The corresponding controller shapes (read the api source)

TASK
Build the five pages with the signature components; component-test VerdictCard and EnvelopePanel.

DELIVERABLES
1. The five pages per the acceptance criteria, reusing the design-system primitives and the
   established hooks.
2. components/labs/VerdictCard.tsx (clean/infected/unknown states with threat rendering),
   components/labs/EnvelopePanel.tsx (status + typed code + message + details tree).
3. Vitest tests for both components across all states.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Honest copy: the tenant page states the app-level prefix design; the checksum demo renders real
  outcomes. TS strict; timeless comments.
- Conventional Commit: `feat(web): labs, tenants, errors and system pages (8.5)`.

Verification:
- `pnpm --filter web build` + `test` green.
- Manual: triggering each error code renders its documented status in the EnvelopePanel.

Completion Protocol:
1. Status ✅ in block + Task index; tick checkboxes; bump header Progress (n/6).
2. Update the P8 row in docs/DEVELOPMENT_PLAN.md §1 and the docs/tasks/README.md mirror.
3. Append `- 8.5 ✅ YYYY-MM-DD: <summary>` to the Completion log.
4. Commit with the Conventional message above.
```

---

### Task 8.6: Phase close

- **Status**: 📋 ToDo
- **Priority**: P0
- **Size**: S
- **Depends on**: 8.1-8.5

#### Description

Audit the phase Definition of Done (including the design-parity screenshot check), sync
dashboards, PR + GitHub Copilot review, merge with CI green.

#### Acceptance criteria

- [ ] Plan P8 Definition of Done verified: build green, zero server-subpath imports in the bundle, every page live against the API, screenshot chrome-indistinguishable from a sibling.
- [ ] Dashboards synced; PR merged squash with Copilot findings addressed and CI green; branch deleted.

#### Files to create / modify

- `docs/tasks/phase-08-web-dashboard.md`, `docs/DEVELOPMENT_PLAN.md`, `docs/tasks/README.md`

#### Agent prompt

```
You are a senior release engineer closing a development phase.

PROJECT: nest-storage-example. Repo: github.com/bymaxone/nest-storage-example.

CURRENT PHASE: 8, Task 8.6 of 6 (LAST: phase close).

PRECONDITIONS
- Tasks 8.1-8.5 ✅ on branch feat/phase-08-web-dashboard; CI green.

REQUIRED READING (only these)
- docs/DEVELOPMENT_PLAN.md §5 (P8 Definition of Done) and §6 (Update Protocol)
- docs/tasks/README.md (Branch & PR workflow)

TASK
Audit (including design parity), sync dashboards, open the PR, obtain and resolve the GitHub
Copilot review, merge clean.

DELIVERABLES
1. Gates green: web build + web tests + api suites; grep proves no bare-library import in apps/web;
   a full-stack manual pass over the ten pages; capture a shell screenshot for the design-parity
   record in the PR body.
2. Update this phase file, plan §1 (P8 row + counters + active phase -> P9), README mirror.
3. `gh pr create --title "feat(web): phase 8, the storage dashboard" --body <summary + parity screenshot>`;
   request the GitHub Copilot review; address EVERY finding.
4. `gh pr merge --squash --delete-branch` with CI green; `git switch main && git pull`.

Constraints:
- Never add Co-Authored-By, 'Generated with', or any AI-attribution line to commits, PR titles, PR bodies, or comments.
- Never merge with a failing check.

Verification:
- PR MERGED; remote branch gone; plan §1 shows P8 ✅ 6/6.

Completion Protocol:
1. Status ✅ everywhere; header Progress 6/6, phase ✅.
2. Update plan §1 + README mirror.
3. Append `- 8.6 ✅ YYYY-MM-DD: phase merged in PR #<n>`.
4. Commit dashboards on main: `docs(plan): mark P8 complete`.
```

## Completion log

<!-- append lines: - N.M ✅ YYYY-MM-DD: summary -->
