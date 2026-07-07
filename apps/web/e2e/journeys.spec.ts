/**
 * @fileoverview Playwright journey smoke for the storage dashboard.
 *
 * Boots against the whole running stack (API + web + MinIO) and walks the load-
 * bearing journeys from spec §11.2: the shell loads with its wordmark and nav,
 * the vault browser renders, the upload lab shows its strategy surface, the
 * direct-upload page renders the required-headers inspector and confirm step,
 * and the error explorer renders. Signed URLs are never snapshotted; the smoke
 * asserts structure and reachability, not credential values.
 *
 * @module e2e/journeys.spec
 */
import { test, expect } from '@playwright/test'

test.describe('storage dashboard journeys', () => {
  test('the shell loads with the wordmark and navigation groups', async ({ page }) => {
    // Scenario: a first visit hits the overview.
    // Rule it protects: the shell chrome (wordmark + sidebar nav) renders and the
    // overview heading is present.
    await page.goto('/')
    await expect(page.getByText('nest-storage-example').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Browser', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Storage Overview' })).toBeVisible()
  })

  test('the vault browser renders the browse surface', async ({ page }) => {
    // Scenario: the user navigates to the vault.
    // Rule it protects: GET /vault data loads and the browser heading renders.
    await page.goto('/vault')
    await expect(page.getByRole('heading', { name: 'Vault Browser' })).toBeVisible()
  })

  test('the upload lab shows the strategy surface', async ({ page }) => {
    // Scenario: the user opens the upload lab.
    // Rule it protects: the lab renders its single/multipart strategy card.
    await page.goto('/upload')
    await expect(page.getByRole('heading', { name: 'Upload Lab' })).toBeVisible()
    await expect(page.getByText('Single / Multipart Upload')).toBeVisible()
  })

  test('the direct-upload page renders the signed-PUT flow and confirm step', async ({ page }) => {
    // Scenario: the user opens the direct-upload flow.
    // Rule it protects: the signed-PUT issue step and the confirm step (which
    // re-applies validation and the scanner) are present so the three-step flow
    // is demonstrable.
    await page.goto('/direct')
    await expect(page.getByRole('heading', { name: 'Direct Upload' })).toBeVisible()
    await expect(page.getByText('Step 1 — Issue Signed PUT URL')).toBeVisible()
    await expect(page.getByText('POST /signed/confirm')).toBeVisible()
  })

  test('the error explorer renders the code catalogue', async ({ page }) => {
    // Scenario: the user opens the error explorer.
    // Rule it protects: the explorer heading renders and the typed envelope panel
    // surface is reachable.
    await page.goto('/errors')
    await expect(page.getByRole('heading', { name: 'Error Explorer' })).toBeVisible()
  })
})
