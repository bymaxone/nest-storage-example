/**
 * @fileoverview Unit tests for the text helpers used to bound demo upload bodies.
 * @layer lib/text.test
 */
import { describe, it, expect } from 'vitest'
import { MAX_TEXT_UPLOAD_BYTES, truncateToByteLength } from './text'

describe('MAX_TEXT_UPLOAD_BYTES', () => {
  it('equals the endpoints 64 KiB text-body cap', () => {
    // Scenario: the constant is the single source of truth for the byte cap.
    // Rule it protects: 64 KiB is 65,536 bytes, matching the server-side limit.
    expect(MAX_TEXT_UPLOAD_BYTES).toBe(65_536)
  })
})

describe('truncateToByteLength', () => {
  it('returns the input unchanged when it already fits', () => {
    // Scenario: a short ASCII string under the limit.
    // Rule it protects: inputs within the cap pass through byte-for-byte.
    expect(truncateToByteLength('hello', 64)).toBe('hello')
  })

  it('returns the input unchanged when it is exactly at the limit', () => {
    // Scenario: an ASCII string whose byte length equals maxBytes.
    // Rule it protects: the boundary uses `<=`, so an exact fit is not truncated.
    const exact = 'a'.repeat(8)
    expect(truncateToByteLength(exact, 8)).toBe(exact)
  })

  it('truncates ASCII to exactly maxBytes when it overflows', () => {
    // Scenario: an oversized single-byte string.
    // Rule it protects: single-byte content is cut to the exact byte budget.
    expect(truncateToByteLength('a'.repeat(100), 10)).toHaveLength(10)
  })

  it('backs off to a character boundary rather than splitting a sequence', () => {
    // Scenario: cutting a 3-byte character (€ = E2 82 AC) at a byte offset that
    // lands mid-sequence. Rule it protects: the loop skips continuation bytes so
    // the result never contains a partial (replacement) character.
    const input = `abc${'€'.repeat(4)}`
    // Budget stops 1 byte into the first euro sign; it must be dropped whole.
    const out = truncateToByteLength(input, 4)
    expect(out).toBe('abc')
    expect(out).not.toContain('�')
  })

  it('keeps a multi-byte character when the budget covers it fully', () => {
    // Scenario: truncating 'ab€cd' (7 bytes) to 5 bytes lands exactly after the
    // 3-byte euro sign. Rule it protects: a character whose bytes all fit within
    // the budget is retained whole, and trailing characters past the cap are cut.
    expect(truncateToByteLength('ab€cd', 5)).toBe('ab€')
  })
})
