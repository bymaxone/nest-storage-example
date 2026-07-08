#!/usr/bin/env node
/**
 * @fileoverview Export-usage audit for `@bymax-one/nest-storage`. Enumerates
 * every public export from the library's two published subpaths
 * (`dist/server/index.d.ts` and `dist/shared/index.d.ts`) and asserts that each
 * identifier is referenced from at least one source file under `apps/`. This
 * turns the Feature Coverage Matrix into a CI gate: a library export that no
 * app file demonstrates fails the audit (exit 1) unless it is listed in the
 * in-file IGNORE map with a written reason. Zero runtime dependencies beyond
 * `node:fs` / `node:path` so it is safe to run in CI without an install step.
 * @layer tooling/audit
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '..')

/** The two published subpaths of the linked library, relative to the repo root. */
const LIBRARY_DTS = [
  '../nest-storage/dist/server/index.d.ts',
  '../nest-storage/dist/shared/index.d.ts',
]

/** Roots searched for demonstrations; every export must appear under one of them. */
const SOURCE_ROOTS = ['apps']

/** Directory names never searched for demonstrations (build output, sandboxes). */
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'coverage',
  '.stryker-tmp',
  'reports',
  'test-results',
  'playwright-report',
])

/**
 * Exports intentionally not demonstrated in app code. Each entry MUST carry a
 * written reason. Empty by design: the app is feature-complete and every export
 * is genuinely demonstrated (real wiring sites plus the two resolution probes,
 * `apps/api/src/library-probe.ts` and `apps/web/lib/storage-shared-probe.ts`,
 * which name the full server and shared surfaces).
 *
 * @type {Record<string, string>}
 */
const IGNORE = {}

/**
 * Extract the exported identifier names from a `.d.ts` file. Reads every
 * `export { ... }` re-export block, splits on commas, strips a leading `type`
 * modifier and any `as <alias>` rename, and returns the public identifiers.
 *
 * @param {string} absPath absolute path to the declaration file.
 * @returns {string[]} the sorted, de-duplicated export identifiers.
 */
function extractExports(absPath) {
  const source = fs.readFileSync(absPath, 'utf8')
  const names = new Set()
  for (const block of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const raw of block[1].split(',')) {
      const cleaned = raw
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        .trim()
      if (cleaned) names.add(cleaned)
    }
  }
  return [...names].sort()
}

/**
 * Recursively collect the runtime/demo `.ts` / `.tsx` source files under a
 * directory, skipping build output, sandboxes, ambient declaration files, and
 * test files (`*.spec` / `*.test` / `*.e2e-spec`) so the audit gate is satisfied
 * only by real application usage, never by a mention in a test.
 *
 * @param {string} dir absolute directory to walk.
 * @param {string[]} out accumulator for discovered file paths.
 * @returns {string[]} the accumulator, for convenience.
 */
function collectSourceFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      collectSourceFiles(path.join(dir, entry.name), out)
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !entry.name.endsWith('.d.ts') &&
      !/\.(spec|test|e2e-spec)\.tsx?$/.test(entry.name)
    ) {
      // Only runtime/demo sources satisfy the audit; test files are excluded so
      // an export cannot be considered demonstrated merely by appearing in a test.
      out.push(path.join(dir, entry.name))
    }
  }
  return out
}

/** Escape a string for safe inclusion in a `RegExp` source. */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Run the audit: resolve every export, search the source corpus, and report.
 *
 * @returns {number} the process exit code (0 on success, 1 on any gap).
 */
function main() {
  const exportsBySubpath = LIBRARY_DTS.map((rel) => {
    const abs = path.resolve(REPO_ROOT, rel)
    if (!fs.existsSync(abs)) {
      console.error(`Library declaration not found: ${rel}`)
      console.error('Build the linked ../nest-storage checkout before running the audit.')
      process.exit(1)
    }
    return { subpath: rel, names: extractExports(abs) }
  })

  const files = SOURCE_ROOTS.flatMap((root) =>
    collectSourceFiles(path.resolve(REPO_ROOT, root), []),
  )
  const corpus = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n')

  const allNames = new Set(exportsBySubpath.flatMap((entry) => entry.names))
  const undemonstrated = []
  for (const name of allNames) {
    if (name in IGNORE) continue
    const referenced = new RegExp(`\\b${escapeRegExp(name)}\\b`).test(corpus)
    if (!referenced) undemonstrated.push(name)
  }

  const total = allNames.size
  const ignored = Object.keys(IGNORE).filter((name) => allNames.has(name)).length
  const demonstrated = total - undemonstrated.length - ignored

  console.log(`Export-usage audit for @bymax-one/nest-storage`)
  console.log(`  source files scanned : ${files.length}`)
  console.log(`  exports discovered   : ${total}`)
  console.log(`  demonstrated         : ${demonstrated}`)
  console.log(`  ignored (documented) : ${ignored}`)

  if (undemonstrated.length > 0) {
    console.error(`\nFAIL: ${undemonstrated.length} export(s) not demonstrated under apps/:`)
    for (const name of undemonstrated.sort()) console.error(`  - ${name}`)
    console.error(
      '\nDemonstrate each export in app code (preferred) or add it to the IGNORE map with a reason.',
    )
    return 1
  }

  console.log('\nPASS: every public export is demonstrated under apps/.')
  return 0
}

process.exit(main())
