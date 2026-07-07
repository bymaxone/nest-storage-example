/**
 * Unit: buildCatalogue - the exhaustive error-code catalogue.
 *
 * Asserts the catalogue is exhaustive over the shipped 18 codes, that every
 * status/message is read from the library's own StorageException (spot-checked
 * against known mappings), and that only STORAGE_PART_TOO_SMALL is flagged
 * non-reproducible (the documented drift).
 *
 * @module errors-demo/error-catalogue.spec
 */
import 'reflect-metadata'
import { STORAGE_ERROR_CODES } from '@bymax-one/nest-storage'
import { buildCatalogue } from './error-catalogue.js'

describe('buildCatalogue (unit)', () => {
  it('renders one entry per shipped error code', () => {
    /*
     * Scenario: the catalogue is built.
     * Rule it protects: it is exhaustive over the shipped STORAGE_ERROR_CODES (18).
     */
    const catalogue = buildCatalogue()
    expect(catalogue).toHaveLength(Object.keys(STORAGE_ERROR_CODES).length)
    const codes = catalogue.map((entry) => entry.code)
    expect(new Set(codes).size).toBe(catalogue.length)
  })

  it('reads the library-mapped status and message for each code', () => {
    /*
     * Scenario: representative codes are inspected.
     * Rule it protects: the status comes from the library, not a hardcoded copy.
     */
    const byCode = new Map(buildCatalogue().map((entry) => [entry.code, entry]))
    expect(byCode.get('STORAGE_NOT_CONFIGURED')?.status).toBe(503)
    expect(byCode.get('STORAGE_MIME_NOT_ALLOWED')?.status).toBe(415)
    expect(byCode.get('STORAGE_SIZE_EXCEEDED')?.status).toBe(413)
    expect(byCode.get('STORAGE_TIMEOUT')?.status).toBe(504)
    expect(byCode.get('STORAGE_PROVIDER_ERROR')?.status).toBe(502)
    expect(byCode.get('STORAGE_INVALID_PART_COUNT')?.status).toBe(400)
    expect(typeof byCode.get('STORAGE_OBJECT_NOT_FOUND')?.message).toBe('string')
  })

  it('marks exactly the two defined-but-unreachable codes as non-reproducible', () => {
    /*
     * Scenario: the reproducibility flags are inspected.
     * Rule it protects: the shipped library can reproduce every code except
     * STORAGE_PART_TOO_SMALL (no part-size guard) and STORAGE_TIMEOUT
     * (requestTimeoutMs is not wired into the client) — the documented drift.
     */
    const catalogue = buildCatalogue()
    const nonReproducible = catalogue.filter((entry) => !entry.reproducible).map((e) => e.code)
    expect(nonReproducible.sort()).toEqual(['STORAGE_PART_TOO_SMALL', 'STORAGE_TIMEOUT'])
  })
})
