/**
 * Unit: upload-url DTO schema.
 *
 * Covers acceptance of a valid request and rejection of an unknown category, a
 * malformed content type, and a non-positive maxSizeBytes.
 *
 * @module signed/dto/upload-url.dto.spec
 */
import 'reflect-metadata'
import { uploadUrlBodySchema } from './upload-url.dto.js'

describe('uploadUrlBodySchema', () => {
  it('accepts a valid category, content type, and optional caps', () => {
    /*
     * Scenario: a well-formed upload-url request.
     * Rule it protects: category, MIME, size, and TTL parse successfully.
     */
    const parsed = uploadUrlBodySchema.safeParse({
      category: 'invoices',
      contentType: 'application/pdf',
      maxSizeBytes: 1024,
      ttlSeconds: 120,
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects an unknown category and a malformed content type', () => {
    /*
     * Scenario: a category outside the enum and a MIME without a subtype.
     * Rule it protects: invalid enums and non type/subtype MIMEs are refused.
     */
    expect(
      uploadUrlBodySchema.safeParse({ category: 'unknown', contentType: 'image/png' }).success,
    ).toBe(false)
    expect(
      uploadUrlBodySchema.safeParse({ category: 'media', contentType: 'notamime' }).success,
    ).toBe(false)
  })

  it('rejects a non-positive maxSizeBytes', () => {
    /*
     * Scenario: a zero or negative size cap.
     * Rule it protects: the advisory cap must be a positive integer.
     */
    expect(
      uploadUrlBodySchema.safeParse({
        category: 'media',
        contentType: 'video/mp4',
        maxSizeBytes: 0,
      }).success,
    ).toBe(false)
  })
})
