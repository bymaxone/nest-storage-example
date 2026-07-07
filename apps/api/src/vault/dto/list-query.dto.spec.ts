/**
 * Unit: listQuerySchema - Zod validation for vault listing query params.
 *
 * Covers: defaults (maxKeys=50), coercion, boundary validation (min=1,
 * max=1000), optional fields (prefix, cursor, delimiter), and delimiter
 * rejection for non-slash values.
 *
 * @module vault/dto/list-query.dto.spec
 */
import { listQuerySchema } from './list-query.dto.js'

describe('listQuerySchema', () => {
  it('applies default maxKeys of 50 when omitted', () => {
    /*
     * Scenario: caller sends no maxKeys; default of 50 is applied.
     * Rule it protects: pages are bounded even when the client omits the param.
     */
    const result = listQuerySchema.parse({})
    expect(result.maxKeys).toBe(50)
  })

  it('coerces a string maxKeys to an integer', () => {
    /*
     * Scenario: query-string delivers maxKeys as '20' (a string); it must
     * coerce to the number 20.
     * Rule it protects: query-string params are strings; Zod coerces them.
     */
    const result = listQuerySchema.parse({ maxKeys: '20' })
    expect(result.maxKeys).toBe(20)
  })

  it('rejects maxKeys below 1', () => {
    /*
     * Scenario: maxKeys=0 is below the minimum allowed page size of 1.
     * Rule it protects: callers cannot request zero-item pages.
     */
    expect(() => listQuerySchema.parse({ maxKeys: 0 })).toThrow()
  })

  it('rejects maxKeys above 1000', () => {
    /*
     * Scenario: maxKeys=1001 exceeds the S3 hard cap of 1000.
     * Rule it protects: the page size is capped at the provider limit.
     */
    expect(() => listQuerySchema.parse({ maxKeys: 1001 })).toThrow()
  })

  it('accepts maxKeys at the boundaries (1 and 1000)', () => {
    /*
     * Scenario: boundary values 1 and 1000 are both valid.
     * Rule it protects: the fence-post values are inclusive.
     */
    expect(listQuerySchema.parse({ maxKeys: 1 }).maxKeys).toBe(1)
    expect(listQuerySchema.parse({ maxKeys: 1000 }).maxKeys).toBe(1000)
  })

  it('accepts an optional prefix string', () => {
    /*
     * Scenario: caller filters by prefix; it passes through unchanged.
     * Rule it protects: prefix is forwarded verbatim to the library.
     */
    const result = listQuerySchema.parse({ prefix: 'avatars/' })
    expect(result.prefix).toBe('avatars/')
  })

  it('accepts an optional cursor string', () => {
    /*
     * Scenario: caller supplies a continuation token from a prior page.
     * Rule it protects: the cursor is forwarded as the S3 ContinuationToken.
     */
    const result = listQuerySchema.parse({ cursor: 'tok123' })
    expect(result.cursor).toBe('tok123')
  })

  it('rejects a prefix longer than 1024 bytes', () => {
    /*
     * Scenario: a 1025-character prefix exceeds the S3 key-length bound.
     * Rule it protects: an unbounded prefix cannot be pushed into the library.
     */
    expect(() => listQuerySchema.parse({ prefix: 'a'.repeat(1025) })).toThrow()
  })

  it('rejects a cursor longer than 1024 bytes', () => {
    /*
     * Scenario: a 1025-character cursor exceeds the bound.
     * Rule it protects: an unbounded continuation token is rejected at the edge.
     */
    expect(() => listQuerySchema.parse({ cursor: 'a'.repeat(1025) })).toThrow()
  })

  it('accepts delimiter "/" for folder aggregation', () => {
    /*
     * Scenario: caller requests pseudo-folder aggregation.
     * Rule it protects: the only valid delimiter value is '/'.
     */
    const result = listQuerySchema.parse({ delimiter: '/' })
    expect(result.delimiter).toBe('/')
  })

  it('rejects a delimiter that is not "/"', () => {
    /*
     * Scenario: caller passes '#' as delimiter; only '/' is supported.
     * Rule it protects: non-slash delimiters are rejected at the schema level.
     */
    expect(() => listQuerySchema.parse({ delimiter: '#' })).toThrow()
  })

  it('treats all optional fields as absent when not provided', () => {
    /*
     * Scenario: minimal call with no optional fields.
     * Rule it protects: optional fields are truly optional and default to
     * undefined (not empty strings or zeros).
     */
    const result = listQuerySchema.parse({})
    expect(result.prefix).toBeUndefined()
    expect(result.cursor).toBeUndefined()
    expect(result.delimiter).toBeUndefined()
  })
})
