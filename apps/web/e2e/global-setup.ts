/**
 * @fileoverview Playwright global setup: brings the compose MinIO stack up with
 * its buckets and seed objects before any journey runs, so the API the dashboard
 * calls has real storage behind it. Idempotent: `docker compose up -d --wait`
 * is a no-op when the stack is already running.
 *
 * @module e2e/global-setup
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Repository root, two levels above `apps/web`. */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

/**
 * Boots the local MinIO stack (buckets + seed) via the repo `infra:up` script.
 * Runs once before the journey suite.
 */
export default function globalSetup(): void {
  execFileSync('pnpm', ['infra:up'], { cwd: repoRoot, stdio: 'inherit' })
}
