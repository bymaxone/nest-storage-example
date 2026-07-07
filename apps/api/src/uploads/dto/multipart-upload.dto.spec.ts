/**
 * Unit: multipart-upload.dto - Zod schema validation for multipart uploads.
 *
 * @module uploads/dto/multipart-upload.dto.spec
 */
import { multipartUploadBodySchema } from './multipart-upload.dto.js'

describe('multipartUploadBodySchema (unit)', () => {
  it('accepts a valid category', () => {
    /*
     * Scenario: valid category enum value.
     * Rule it protects: schema passes for any of the four categories.
     */
    const result = multipartUploadBodySchema.safeParse({ category: 'media' })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid category', () => {
    /*
     * Scenario: unrecognised category.
     * Rule it protects: only the four allowed categories pass.
     */
    const result = multipartUploadBodySchema.safeParse({ category: 'unknown' })
    expect(result.success).toBe(false)
  })
})
