/**
 * Unit: bulkDeleteBodySchema - Zod validation for bulk-delete request body.
 *
 * Covers: valid single-key array, valid 1000-key array (max), rejection below
 * 1 (empty array), rejection above 1000, and rejection of empty-string keys.
 *
 * @module vault/dto/bulk-delete.dto.spec
 */
import { bulkDeleteBodySchema } from './bulk-delete.dto.js'

describe('bulkDeleteBodySchema', () => {
  it('accepts a single valid key', () => {
    /*
     * Scenario: minimal valid body with one key.
     * Rule it protects: at least one key is required.
     */
    const result = bulkDeleteBodySchema.parse({ keys: ['avatars/uuid.png'] })
    expect(result.keys).toEqual(['avatars/uuid.png'])
  })

  it('accepts exactly 1000 keys (upper boundary)', () => {
    /*
     * Scenario: exactly 1000 keys passes the max check.
     * Rule it protects: the boundary is inclusive; 1000 is the S3 hard cap.
     */
    const keys = Array.from({ length: 1000 }, (_, i) => `key-${i}`)
    const result = bulkDeleteBodySchema.parse({ keys })
    expect(result.keys).toHaveLength(1000)
  })

  it('rejects an empty keys array', () => {
    /*
     * Scenario: empty array; at least one key is required.
     * Rule it protects: bulk-delete with zero keys is a client error.
     */
    expect(() => bulkDeleteBodySchema.parse({ keys: [] })).toThrow()
  })

  it('rejects 1001 keys (above the S3 hard cap)', () => {
    /*
     * Scenario: 1001 keys exceed the S3 DeleteObjects limit.
     * Rule it protects: callers must batch requests themselves above 1000.
     */
    const keys = Array.from({ length: 1001 }, (_, i) => `key-${i}`)
    expect(() => bulkDeleteBodySchema.parse({ keys })).toThrow()
  })

  it('rejects an array containing an empty string', () => {
    /*
     * Scenario: one key is an empty string; S3 keys must be non-empty.
     * Rule it protects: empty-string keys would silently fail at the provider.
     */
    expect(() => bulkDeleteBodySchema.parse({ keys: ['valid', ''] })).toThrow()
  })

  it('rejects a key exceeding 1024 bytes', () => {
    /*
     * Scenario: S3 key length limit is 1024 bytes.
     * Rule it protects: oversized keys are rejected before reaching the provider.
     */
    const longKey = 'a'.repeat(1025)
    expect(() => bulkDeleteBodySchema.parse({ keys: [longKey] })).toThrow()
  })
})
