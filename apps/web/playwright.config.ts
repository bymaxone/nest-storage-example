/**
 * @fileoverview Playwright configuration for the storage dashboard journey smoke.
 *
 * Boots the whole stack the way a developer runs it: `globalSetup` brings up the
 * compose MinIO (buckets + seed) and the API and web dev servers are started as
 * Playwright `webServer` entries. Everything runs on a single worker, one browser
 * at a time, so the suite is memory-safe alongside the unit and e2e tiers (the
 * library is loaded once by the API process, never fanned out).
 *
 * @module playwright.config
 */
import { defineConfig, devices } from '@playwright/test'

/** The dashboard origin the journeys navigate. */
const WEB_URL = 'http://localhost:3000'

/** The API origin the dashboard calls; also the health probe target. */
const API_URL = 'http://localhost:3001'

/** Whether the run is on CI (no server reuse, retries enabled). */
const isCI = process.env['CI'] === 'true'

/** Generous boot window: dev servers compile on demand on the first navigation. */
const SERVER_TIMEOUT_MS = 180_000

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['list']] : [['list']],
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @nest-storage-example/api run dev',
      url: `${API_URL}/health`,
      reuseExistingServer: !isCI,
      timeout: SERVER_TIMEOUT_MS,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter web run dev',
      url: WEB_URL,
      reuseExistingServer: !isCI,
      timeout: SERVER_TIMEOUT_MS,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
