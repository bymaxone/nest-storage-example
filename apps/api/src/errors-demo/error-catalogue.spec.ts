/**
 * Unit: buildCatalogue - the exhaustive error-code catalogue.
 *
 * Asserts the catalogue is exhaustive over the shipped 18 codes, that every
 * status/message is read from the library's own StorageException (spot-checked
 * against known mappings), and that STORAGE_PART_TOO_SMALL and STORAGE_TIMEOUT
 * are the codes flagged non-reproducible (the documented drift).
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

  it('pins the exact trigger recipe text for every shipped code', () => {
    /*
     * Scenario: the trigger prose is inspected for every code.
     * Rule it protects: each catalogue row carries its exact, non-empty trigger
     * recipe (a mutant that blanks or swaps any recipe string is caught).
     */
    const byCode = new Map<string, string>(
      buildCatalogue().map((entry) => [entry.code, entry.trigger]),
    )
    const expected: Record<string, string> = {
      STORAGE_NOT_CONFIGURED:
        'A scoped module instance built with empty credentials; any operation asserts configuration first.',
      STORAGE_KEY_INVALID:
        'An upload whose key contains a `..` traversal segment; the key resolver rejects it.',
      STORAGE_BODY_MISSING: 'An upload call with no body.',
      STORAGE_CONTENT_TYPE_REQUIRED: 'An upload call with an empty content type.',
      STORAGE_MIME_NOT_ALLOWED: 'An upload of `application/zip` against the module MIME whitelist.',
      STORAGE_SIZE_EXCEEDED: 'An upload whose declared size exceeds the configured `maxSizeBytes`.',
      STORAGE_VALIDATION_FAILED:
        'A body declared `application/pdf` without the `%PDF` magic bytes; the custom validator rejects it.',
      STORAGE_SCAN_INFECTED:
        'A body carrying the inert `X-DEMO-INFECTED` marker; the scanner reports infected.',
      STORAGE_SCAN_INCONCLUSIVE:
        'A scoped instance with `rejectOnUnknown: true` scanning an `X-DEMO-UNKNOWN` body.',
      STORAGE_OBJECT_NOT_FOUND: 'A head() on a key that does not exist.',
      STORAGE_PROVIDER_ERROR:
        'A scoped instance pointed at the real endpoint with wrong credentials; the provider rejects with 403.',
      STORAGE_SIGNED_URL_TTL_INVALID: 'A signed download URL requested with `ttlSeconds: 0`.',
      STORAGE_PART_TOO_SMALL:
        'DEFINED BUT NOT THROWN by the shipped library: no public method guards part size. A real sub-5 MiB non-final part surfaces from the provider as EntityTooSmall, which the library maps to STORAGE_PROVIDER_ERROR.',
      STORAGE_INVALID_PART_COUNT: 'A presigned multipart request with `parts: 0`.',
      STORAGE_BUCKET_UNDEFINED:
        'A head() call with an empty per-call bucket override and no default.',
      STORAGE_MULTIPART_ABORTED:
        'A wrong-credentials scoped instance forced onto the multipart path (unknown-size stream); CreateMultipartUpload fails and the upload aborts.',
      STORAGE_INVALID_CONFIG:
        'A `BymaxStorageModule.forRoot({})` probe with missing required options.',
      STORAGE_TIMEOUT:
        'DEFINED BUT NOT REPRODUCIBLE via the shipped library: `requestTimeoutMs` is resolved in options but never wired into the S3 client request handler, so the SDK issues no request/connection timeout and never emits the TimeoutError that STORAGE_TIMEOUT maps from. A real timeout needs a request-handler timeout the library does not expose.',
    }
    for (const [code, trigger] of Object.entries(expected)) {
      expect(byCode.get(code)).toBe(trigger)
    }
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
