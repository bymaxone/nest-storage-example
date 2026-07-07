/**
 * Unit: download.dto - Zod schema validation for vault download queries.
 *
 * @module vault/dto/download.dto.spec
 */
import { downloadQuerySchema, rangeQuerySchema, versionQuerySchema } from './download.dto.js'

describe('downloadQuerySchema (unit)', () => {
  it('accepts a non-empty key', () => {
    /*
     * Scenario: valid key query parameter.
     * Rule it protects: minimum key length of 1 is accepted.
     */
    const result = downloadQuerySchema.safeParse({ key: 'avatars/uuid.png' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty key', () => {
    /*
     * Scenario: empty string key.
     * Rule it protects: empty keys are rejected before reaching the service.
     */
    const result = downloadQuerySchema.safeParse({ key: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing key', () => {
    /*
     * Scenario: key field absent.
     * Rule it protects: the required key field is enforced.
     */
    const result = downloadQuerySchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('rangeQuerySchema (unit)', () => {
  it('accepts valid key, start, and end', () => {
    /*
     * Scenario: valid range query for bytes 0-1023.
     * Rule it protects: coercion works for numeric query strings.
     */
    const result = rangeQuerySchema.safeParse({ key: 'my/key', start: '0', end: '1023' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.start).toBe(0)
      expect(result.data.end).toBe(1023)
    }
  })

  it('rejects a negative start', () => {
    /*
     * Scenario: negative start value.
     * Rule it protects: byte offsets must be non-negative.
     */
    const result = rangeQuerySchema.safeParse({ key: 'k', start: '-1', end: '10' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing end', () => {
    /*
     * Scenario: end field omitted.
     * Rule it protects: both start and end are required.
     */
    const result = rangeQuerySchema.safeParse({ key: 'k', start: '0' })
    expect(result.success).toBe(false)
  })
})

describe('versionQuerySchema (unit)', () => {
  it('accepts a key and versionId', () => {
    /*
     * Scenario: valid version query.
     * Rule it protects: both fields are accepted and preserved.
     */
    const result = versionQuerySchema.safeParse({ key: 'doc.pdf', versionId: 'v-abc123' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.versionId).toBe('v-abc123')
    }
  })

  it('rejects an empty versionId', () => {
    /*
     * Scenario: empty versionId string.
     * Rule it protects: minimum length of 1 is enforced.
     */
    const result = versionQuerySchema.safeParse({ key: 'doc.pdf', versionId: '' })
    expect(result.success).toBe(false)
  })
})
