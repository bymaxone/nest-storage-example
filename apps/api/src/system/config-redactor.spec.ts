/**
 * Unit: redactStorageOptions - credential-safe, introspectable rendering.
 *
 * Covers masking of the access key id, full redaction of the secret and session
 * token, the credentials-absent clone, a short-key mask, input immutability, the
 * guarantee that a planted secret never survives, and the introspection
 * rendering of the scanner (impl by name, mode, rejectOnUnknown) and validation
 * (custom validators by name) blocks.
 *
 * @module system/config-redactor.spec
 */
import type { IFileScanner, IUploadValidator } from '@bymax-one/nest-storage'
import { redactStorageOptions, type RedactableStorageOptions } from './config-redactor.js'

/** A named scanner stub whose class name is rendered by the redactor. */
class DemoScanner implements IFileScanner {
  scan(): ReturnType<IFileScanner['scan']> {
    return Promise.resolve({ status: 'clean', engine: 'demo' })
  }
}

/** A named validator stub whose `name` is rendered by the redactor. */
const namedValidator: IUploadValidator = {
  name: 'demo-validator',
  validate: () => Promise.resolve({ ok: true }),
}

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

  it('returns an equal clone when credentials are absent', () => {
    /*
     * Scenario: an unconfigured module has no credentials, scanner, or validation.
     * Rule it protects: the redactor returns a value-equal copy (no credentials
     * key added) rather than throwing on a missing credentials object.
     */
    const options = { ...base }
    const redacted = redactStorageOptions(options)
    expect(redacted).toEqual(base)
    expect(redacted.credentials).toBeUndefined()
  })

  it('renders the scanner impl by name with its mode and reject flag', () => {
    /*
     * Scenario: options carry a live scanner instance with mode and reject flag.
     * Rule it protects: the impl is summarized by its class name (never serialized
     * as an opaque object) and the resolved settings are surfaced as plain values.
     */
    const redacted = redactStorageOptions({
      ...base,
      scanner: { impl: new DemoScanner(), mode: 'post-upload', rejectOnUnknown: true },
    })
    expect(redacted.scanner).toEqual({
      impl: 'DemoScanner',
      mode: 'post-upload',
      rejectOnUnknown: true,
    })
  })

  it('renders a scanner without optional mode or reject flag', () => {
    /*
     * Scenario: a scanner is configured with only an impl.
     * Rule it protects: absent mode and rejectOnUnknown are omitted rather than
     * emitted as undefined.
     */
    const redacted = redactStorageOptions({ ...base, scanner: { impl: new DemoScanner() } })
    expect(redacted.scanner).toEqual({ impl: 'DemoScanner' })
  })

  it('renders custom validators by name with the whitelist and size cap', () => {
    /*
     * Scenario: options carry live custom validators plus a whitelist and cap.
     * Rule it protects: validators are summarized by name and the plain-value
     * whitelist and size cap pass through.
     */
    const redacted = redactStorageOptions({
      ...base,
      validation: {
        mimeWhitelist: ['image/png'],
        maxSizeBytes: 4096,
        customValidators: [namedValidator],
      },
    })
    expect(redacted.validation).toEqual({
      mimeWhitelist: ['image/png'],
      maxSizeBytes: 4096,
      customValidators: ['demo-validator'],
    })
  })

  it('renders an empty validation block without optional fields', () => {
    /*
     * Scenario: a validation block is present but carries no fields.
     * Rule it protects: an empty validation object renders as empty rather than
     * emitting undefined fields.
     */
    const redacted = redactStorageOptions({ ...base, validation: {} })
    expect(redacted.validation).toEqual({})
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
