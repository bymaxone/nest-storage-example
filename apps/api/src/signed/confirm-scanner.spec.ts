/**
 * Unit: NoOpConfirmScanner - the default confirm-time scanner seam.
 *
 * Covers the no-op default returning a `skipped` verdict so the bypass boundary
 * stays explicit until a real scanner is wired.
 *
 * @module signed/confirm-scanner.spec
 */
import 'reflect-metadata'
import { NoOpConfirmScanner } from './confirm-scanner.js'

describe('NoOpConfirmScanner (unit)', () => {
  it('reports a skipped verdict without inspecting the object', async () => {
    /*
     * Scenario: the default scanner is asked to scan a landed object.
     * Rule it protects: it returns `skipped`, signalling the object was not
     * inspected rather than implying it is clean.
     */
    const scanner = new NoOpConfirmScanner()
    await expect(scanner.scan()).resolves.toEqual({ status: 'skipped' })
  })
})
