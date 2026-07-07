/**
 * Unit: idempotent-upload.dto - Zod schema validation for idempotent uploads.
 *
 * @module uploads/dto/idempotent-upload.dto.spec
 */
import { idempotentUploadBodySchema } from './idempotent-upload.dto.js'

describe('idempotentUploadBodySchema (unit)', () => {
  it('accepts a valid body with all required fields', () => {
    /*
     * Scenario: full valid body.
     * Rule it protects: all three required fields pass together.
     */
    const result = idempotentUploadBodySchema.safeParse({
      idempotencyKey: 'unique-key-123',
      content: 'hello world',
      contentType: 'text/plain',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty idempotencyKey', () => {
    /*
     * Scenario: empty string for idempotencyKey.
     * Rule it protects: minimum length of 1 is enforced.
     */
    const result = idempotentUploadBodySchema.safeParse({
      idempotencyKey: '',
      content: 'data',
      contentType: 'text/plain',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty content', () => {
    /*
     * Scenario: empty content string.
     * Rule it protects: content must be non-empty.
     */
    const result = idempotentUploadBodySchema.safeParse({
      idempotencyKey: 'key',
      content: '',
      contentType: 'text/plain',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a missing contentType', () => {
    /*
     * Scenario: contentType omitted from the body.
     * Rule it protects: all three fields are required.
     */
    const result = idempotentUploadBodySchema.safeParse({
      idempotencyKey: 'key',
      content: 'data',
    })
    expect(result.success).toBe(false)
  })
})
