/**
 * Unit: stream-upload.dto - Zod schema validation for stream uploads.
 *
 * @module uploads/dto/stream-upload.dto.spec
 */
import { streamUploadQuerySchema } from './stream-upload.dto.js'

describe('streamUploadQuerySchema (unit)', () => {
  it('accepts a valid category with knownSize defaulting to true', () => {
    /*
     * Scenario: only category provided; knownSize defaults to true.
     * Rule it protects: omitting knownSize does not force the multipart path.
     */
    const result = streamUploadQuerySchema.safeParse({ category: 'media' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.knownSize).toBe(true)
    }
  })

  it("transforms knownSize='false' to false", () => {
    /*
     * Scenario: knownSize string 'false' from the query string.
     * Rule it protects: the string 'false' disables the size hint.
     */
    const result = streamUploadQuerySchema.safeParse({ category: 'media', knownSize: 'false' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.knownSize).toBe(false)
    }
  })

  it("transforms knownSize='true' to true", () => {
    /*
     * Scenario: knownSize string 'true' from the query string.
     * Rule it protects: the string 'true' enables the size hint.
     */
    const result = streamUploadQuerySchema.safeParse({ category: 'media', knownSize: 'true' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.knownSize).toBe(true)
    }
  })

  it('rejects an invalid category', () => {
    /*
     * Scenario: unrecognised category.
     * Rule it protects: only the four allowed categories pass.
     */
    const result = streamUploadQuerySchema.safeParse({ category: 'xyz' })
    expect(result.success).toBe(false)
  })

  it('accepts an optional filename', () => {
    /*
     * Scenario: filename provided in query string.
     * Rule it protects: filename is accepted and preserved.
     */
    const result = streamUploadQuerySchema.safeParse({ category: 'media', filename: 'vid.mp4' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.filename).toBe('vid.mp4')
    }
  })
})
