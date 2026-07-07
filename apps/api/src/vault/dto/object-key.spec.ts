/**
 * Unit: objectKeySchema - shared S3 object-key validation.
 *
 * Covers: acceptance of a normal key and a Unicode key, rejection of the empty
 * string, rejection above 1024 bytes, and rejection of C0 control characters
 * (null byte, unit separator) and DEL.
 *
 * @module vault/dto/object-key.spec
 */
import { objectKeySchema } from './object-key.js'

/** Builds a key with a single control character spliced into the middle. */
function keyWith(codePoint: number): string {
  return `bad${String.fromCodePoint(codePoint)}key`
}

describe('objectKeySchema', () => {
  it('accepts a normal path-style key', () => {
    /*
     * Scenario: a typical seeded key with slashes and a file extension.
     * Rule it protects: legitimate keys pass unchanged.
     */
    expect(objectKeySchema.parse('avatars/uuid.png')).toBe('avatars/uuid.png')
  })

  it('accepts a key containing higher Unicode characters', () => {
    /*
     * Scenario: a key with accented and non-Latin characters (valid in S3).
     * Rule it protects: only control characters are rejected, not Unicode.
     */
    const key = 'docs/relatório-café-日本.pdf'
    expect(objectKeySchema.parse(key)).toBe(key)
  })

  it('rejects the empty string', () => {
    /*
     * Scenario: an empty key.
     * Rule it protects: keys must be non-empty (min 1).
     */
    expect(() => objectKeySchema.parse('')).toThrow()
  })

  it('rejects a key longer than 1024 bytes', () => {
    /*
     * Scenario: a 1025-character key exceeds the S3 key-length limit.
     * Rule it protects: oversized keys are rejected before reaching the provider.
     */
    expect(() => objectKeySchema.parse('a'.repeat(1025))).toThrow()
  })

  it('rejects a key containing a null byte', () => {
    /*
     * Scenario: a key with an embedded null byte (0x00).
     * Rule it protects: C0 control characters that S3 rejects or silently
     * transforms never reach the provider.
     */
    expect(() => objectKeySchema.parse(keyWith(0x00))).toThrow()
  })

  it('rejects a key containing a unit-separator control character', () => {
    /*
     * Scenario: a key with the last C0 control character (0x1f).
     * Rule it protects: the whole C0 range (through 0x1f) is rejected.
     */
    expect(() => objectKeySchema.parse(keyWith(0x1f))).toThrow()
  })

  it('rejects a key containing the DEL character', () => {
    /*
     * Scenario: a key with DEL (0x7f), just past the printable ASCII range.
     * Rule it protects: DEL is rejected alongside the C0 controls.
     */
    expect(() => objectKeySchema.parse(keyWith(0x7f))).toThrow()
  })
})
