/**
 * Unit: redactStorageOptions - credential-safe cloning for introspection.
 *
 * Covers masking of the access key id, full redaction of the secret and session
 * token, the credentials-absent passthrough, a short-key mask, input
 * immutability, and the guarantee that a planted secret never survives.
 *
 * @module system/config-redactor.spec
 */
import { redactStorageOptions, type RedactableStorageOptions } from './config-redactor.js'

/** Minimal required options shell shared by the tests. */
const base: RedactableStorageOptions = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  bucket: 'vault',
}

describe('redactStorageOptions (unit)', () => {
  it('masks the access key id and redacts the secret access key', () => {
    /*
     * Scenario: options carry credentials without a session token.
     * Rule it protects: the access key id keeps only its first four chars and the
     * secret access key is fully redacted; no session token key is added.
     */
    const redacted = redactStorageOptions({
      ...base,
      credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'super-secret-value' },
    })

    expect(redacted.credentials?.accessKeyId).toBe('mini******')
    expect(redacted.credentials?.secretAccessKey).toBe('[redacted]')
    expect(redacted.credentials?.sessionToken).toBeUndefined()
  })

  it('redacts a session token when present', () => {
    /*
     * Scenario: options include an STS session token.
     * Rule it protects: the session token is redacted too (the conditional-spread
     * "on" arm), never returned in the clear.
     */
    const redacted = redactStorageOptions({
      ...base,
      credentials: {
        accessKeyId: 'minioadmin',
        secretAccessKey: 'super-secret-value',
        sessionToken: 'session-token-value',
      },
    })

    expect(redacted.credentials?.sessionToken).toBe('[redacted]')
  })

  it('returns options unchanged when credentials are absent', () => {
    /*
     * Scenario: an unconfigured module has no credentials.
     * Rule it protects: the credentials-absent arm returns the options as-is
     * rather than throwing on a missing credentials object.
     */
    const options = { ...base }
    expect(redactStorageOptions(options)).toBe(options)
  })

  it('masks a short access key id without a negative repeat count', () => {
    /*
     * Scenario: an access key id shorter than the visible-char window.
     * Rule it protects: the hidden-char count floors at zero, so a two-char key
     * masks to itself rather than throwing on a negative repeat.
     */
    const redacted = redactStorageOptions({
      ...base,
      credentials: { accessKeyId: 'ab', secretAccessKey: 'x' },
    })

    expect(redacted.credentials?.accessKeyId).toBe('ab')
  })

  it('never leaks a planted secret and does not mutate the input', () => {
    /*
     * Scenario: a distinctive secret is planted in the input.
     * Rule it protects: the serialized clone never contains the secret, and the
     * original options object is left untouched (pure function).
     */
    const secret = 'planted-secret-1234'
    const input = {
      ...base,
      credentials: { accessKeyId: 'minioadmin', secretAccessKey: secret },
    }

    const redacted = redactStorageOptions(input)

    expect(JSON.stringify(redacted)).not.toContain(secret)
    expect(input.credentials?.secretAccessKey).toBe(secret)
  })
})
