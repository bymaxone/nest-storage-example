/**
 * Unit: single-upload.dto - Zod schema validation for single and SSE-override uploads.
 *
 * @module uploads/dto/single-upload.dto.spec
 */
import { singleUploadBodySchema, sseOverrideBodySchema } from './single-upload.dto.js'

describe('singleUploadBodySchema (unit)', () => {
  it('accepts a valid category with optional fields', () => {
    /*
     * Scenario: minimum valid body with category only.
     * Rule it protects: schema passes with only the required field.
     */
    const result = singleUploadBodySchema.safeParse({ category: 'avatars' })
    expect(result.success).toBe(true)
  })

  it('accepts all optional header fields when provided', () => {
    /*
     * Scenario: all fields provided.
     * Rule it protects: optional fields are accepted without errors.
     */
    const result = singleUploadBodySchema.safeParse({
      category: 'invoices',
      cacheControl: 'public, max-age=3600',
      contentDisposition: 'inline',
      metadata: { tag: 'test' },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.metadata).toEqual({ tag: 'test' })
    }
  })

  it('rejects an invalid category', () => {
    /*
     * Scenario: unknown category value.
     * Rule it protects: only the four allowed categories are accepted.
     */
    const result = singleUploadBodySchema.safeParse({ category: 'photos' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing category', () => {
    /*
     * Scenario: no category field at all.
     * Rule it protects: the required field is enforced.
     */
    const result = singleUploadBodySchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('sseOverrideBodySchema (unit)', () => {
  it('accepts AES256 serverSideEncryption', () => {
    /*
     * Scenario: AES256 SSE value.
     * Rule it protects: AES256 is a valid enum value.
     */
    const result = sseOverrideBodySchema.safeParse({
      category: 'avatars',
      serverSideEncryption: 'AES256',
    })
    expect(result.success).toBe(true)
  })

  it("accepts 'NONE' as the sentinel", () => {
    /*
     * Scenario: NONE sentinel to disable global SSE.
     * Rule it protects: 'NONE' is accepted and passed through unchanged.
     */
    const result = sseOverrideBodySchema.safeParse({
      category: 'avatars',
      serverSideEncryption: 'NONE',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.serverSideEncryption).toBe('NONE')
    }
  })

  it('rejects an unknown SSE value', () => {
    /*
     * Scenario: unrecognised SSE algorithm.
     * Rule it protects: only AES256, aws:kms, and NONE are allowed.
     */
    const result = sseOverrideBodySchema.safeParse({
      category: 'avatars',
      serverSideEncryption: 'TRIPLE_DES',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a body missing serverSideEncryption', () => {
    /*
     * Scenario: SSE override body without the encryption field.
     * Rule it protects: serverSideEncryption is required on this schema.
     */
    const result = sseOverrideBodySchema.safeParse({ category: 'avatars' })
    expect(result.success).toBe(false)
  })
})
