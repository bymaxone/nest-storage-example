/**
 * Unit: multipart-urls and multipart-abort DTO schemas.
 *
 * Covers acceptance of a valid issuance request, the 1..1000 part-count
 * boundaries, and abort acceptance/rejection.
 *
 * @module signed/dto/multipart-urls.dto.spec
 */
import 'reflect-metadata'
import {
  multipartUrlsBodySchema,
  multipartAbortBodySchema,
  MAX_MULTIPART_PARTS,
} from './multipart-urls.dto.js'

describe('multipartUrlsBodySchema', () => {
  it('accepts a valid multipart issuance request', () => {
    /*
     * Scenario: a well-formed multipart-urls request.
     * Rule it protects: category, MIME, and part count parse successfully.
     */
    expect(
      multipartUrlsBodySchema.safeParse({ category: 'media', contentType: 'video/mp4', parts: 3 })
        .success,
    ).toBe(true)
  })

  it('enforces the 1..MAX part-count boundaries', () => {
    /*
     * Scenario: part counts at and beyond the allowed range.
     * Rule it protects: 0 and MAX+1 are refused; 1 and MAX are accepted.
     */
    const base = { category: 'media', contentType: 'video/mp4' } as const
    expect(multipartUrlsBodySchema.safeParse({ ...base, parts: 0 }).success).toBe(false)
    expect(multipartUrlsBodySchema.safeParse({ ...base, parts: 1 }).success).toBe(true)
    expect(multipartUrlsBodySchema.safeParse({ ...base, parts: MAX_MULTIPART_PARTS }).success).toBe(
      true,
    )
    expect(
      multipartUrlsBodySchema.safeParse({ ...base, parts: MAX_MULTIPART_PARTS + 1 }).success,
    ).toBe(false)
  })
})

describe('multipartAbortBodySchema', () => {
  it('accepts a key and uploadId, and rejects an empty uploadId', () => {
    /*
     * Scenario: valid and empty abort requests.
     * Rule it protects: both key and a non-empty uploadId are required.
     */
    expect(
      multipartAbortBodySchema.safeParse({ key: 'media/x.mp4', uploadId: 'UP-1' }).success,
    ).toBe(true)
    expect(multipartAbortBodySchema.safeParse({ key: 'media/x.mp4', uploadId: '' }).success).toBe(
      false,
    )
  })
})
