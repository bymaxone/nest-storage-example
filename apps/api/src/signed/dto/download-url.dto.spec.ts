/**
 * Unit: download-url DTO schema.
 *
 * Covers acceptance of a full request, the deliberate pass-through of a
 * non-positive TTL (so the library, not the DTO, rejects it), and rejection of
 * non-integer TTLs and control characters in the header overrides.
 *
 * @module signed/dto/download-url.dto.spec
 */
import 'reflect-metadata'
import { downloadUrlBodySchema } from './download-url.dto.js'

describe('downloadUrlBodySchema', () => {
  it('accepts a key with overrides and a positive TTL', () => {
    /*
     * Scenario: a fully specified download-url request.
     * Rule it protects: valid overrides and TTL parse successfully.
     */
    const parsed = downloadUrlBodySchema.safeParse({
      key: 'avatars/a.png',
      ttlSeconds: 300,
      responseContentDisposition: 'attachment; filename="a.png"',
      responseContentType: 'image/png',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts a non-positive TTL so the library emits the invalid-TTL envelope', () => {
    /*
     * Scenario: ttlSeconds is 0 or negative.
     * Rule it protects: the DTO forwards it rather than hand-rolling a 400.
     */
    expect(downloadUrlBodySchema.safeParse({ key: 'a/b', ttlSeconds: 0 }).success).toBe(true)
    expect(downloadUrlBodySchema.safeParse({ key: 'a/b', ttlSeconds: -5 }).success).toBe(true)
  })

  it('rejects a non-integer TTL and control characters in an override', () => {
    /*
     * Scenario: a fractional TTL and a CRLF-bearing override.
     * Rule it protects: NaN/float TTLs and header-injection payloads are refused.
     */
    expect(downloadUrlBodySchema.safeParse({ key: 'a/b', ttlSeconds: 1.5 }).success).toBe(false)
    expect(
      downloadUrlBodySchema.safeParse({ key: 'a/b', responseContentType: 'image/png\r\nX: y' })
        .success,
    ).toBe(false)
  })
})
