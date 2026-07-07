/**
 * Unit: confirm DTO schema.
 *
 * Covers acceptance of a valid key and rejection of an empty key.
 *
 * @module signed/dto/confirm.dto.spec
 */
import 'reflect-metadata'
import { confirmBodySchema } from './confirm.dto.js'

describe('confirmBodySchema', () => {
  it('accepts a valid object key', () => {
    /*
     * Scenario: a confirm request with a real key.
     * Rule it protects: a valid key parses successfully.
     */
    expect(confirmBodySchema.safeParse({ key: 'avatars/uuid.png' }).success).toBe(true)
  })

  it('rejects an empty key', () => {
    /*
     * Scenario: a confirm request with an empty key.
     * Rule it protects: the shared object-key schema refuses an empty string.
     */
    expect(confirmBodySchema.safeParse({ key: '' }).success).toBe(false)
  })
})
