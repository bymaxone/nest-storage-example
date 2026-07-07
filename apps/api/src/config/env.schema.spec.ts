/**
 * Unit: environment schema, aggregated validator, and boot loader.
 *
 * Covers the default-fill happy path, the coercion-free `envBoolean` transform
 * (every operand of its `||` chain), each failure class (bad number, bad enum,
 * bad URL), the multi-violation aggregation, the value-free (no-secret-echo)
 * guarantee, the root-path branch, and the boot loader.
 *
 * @module config/env.schema.spec
 */
import { envSchema, validateEnv, loadEnv } from './env.schema.js'

describe('envSchema defaults', () => {
  it('fills every default when the input is empty', () => {
    /*
     * Scenario: parse an empty object.
     * Rule it protects: each declared `.default(...)` applies so local dev needs
     * no env file, booleans resolve to their real defaults, and the CDN/SSE
     * "off" states are empty strings.
     */
    const env = envSchema.parse({})

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3001,
      WEB_ORIGIN: 'http://localhost:3000',
      STORAGE_ENDPOINT: 'http://localhost:9000',
      STORAGE_REGION: 'us-east-1',
      STORAGE_BUCKET: 'vault',
      STORAGE_ARCHIVE_BUCKET: 'vault-archive',
      STORAGE_VERSIONED_BUCKET: 'vault-versioned',
      STORAGE_ACCESS_KEY_ID: 'minioadmin',
      STORAGE_SECRET_ACCESS_KEY: 'minioadmin',
      STORAGE_FORCE_PATH_STYLE: true,
      STORAGE_PUBLIC_BASE_URL: 'http://localhost:9000/vault',
      STORAGE_CDN_BASE_URL: '',
      STORAGE_KEY_PREFIX: 'storage-example',
      STORAGE_SSE: '',
      STORAGE_CHECKSUM_MODE: 'WHEN_REQUIRED',
      STORAGE_MAX_TTL_SECONDS: 3600,
      STORAGE_MULTIPART_THRESHOLD: 5_242_880,
      SCANNER_MODE: 'pre-upload',
      SCANNER_REJECT_ON_UNKNOWN: false,
      UPLOAD_MAX_SIZE_BYTES: 26_214_400,
    })
  })
})

describe('envBoolean transform', () => {
  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
    ['anything-else', false],
  ])('parses STORAGE_FORCE_PATH_STYLE=%p as %p', (raw, expected) => {
    /*
     * Scenario: the boolean var arrives as each meaningful string.
     * Rule it protects: only `'true'`/`'1'` are truthy - `'false'` and other
     * strings are false, dodging the `Boolean('false') === true` coercion trap
     * (exercises the `'true'` and `'1'` operands and the final false arm).
     */
    expect(envSchema.parse({ STORAGE_FORCE_PATH_STYLE: raw }).STORAGE_FORCE_PATH_STYLE).toBe(
      expected,
    )
  })

  it('treats a real boolean true as truthy (first operand)', () => {
    /*
     * Scenario: a caller passes an actual boolean (not a string).
     * Rule it protects: the `value === true` operand short-circuits, so a
     * programmatic boolean is honoured directly.
     */
    expect(envSchema.parse({ SCANNER_REJECT_ON_UNKNOWN: true }).SCANNER_REJECT_ON_UNKNOWN).toBe(
      true,
    )
  })
})

describe('validateEnv', () => {
  it('returns the typed env on valid input', () => {
    /*
     * Scenario: a fully valid environment record.
     * Rule it protects: the success arm returns the coerced, typed data (PORT is
     * a number, not the original string).
     */
    const env = validateEnv({ PORT: '4000' })
    expect(env.PORT).toBe(4000)
  })

  it('reports a bad number by variable name', () => {
    /*
     * Scenario: PORT is not numeric.
     * Rule it protects: the failure arm throws and names the offending variable.
     */
    expect(() => validateEnv({ PORT: 'not-a-number' })).toThrow(/PORT/)
  })

  it('reports a bad enum by variable name', () => {
    /*
     * Scenario: SCANNER_MODE is outside the allowed set.
     * Rule it protects: enum violations are reported against the variable name.
     */
    expect(() => validateEnv({ SCANNER_MODE: 'sideways' })).toThrow(/SCANNER_MODE/)
  })

  it('reports a bad URL by variable name', () => {
    /*
     * Scenario: STORAGE_ENDPOINT is set to an empty string (default suppressed).
     * Rule it protects: URL violations are reported against the variable name.
     */
    expect(() => validateEnv({ STORAGE_ENDPOINT: '' })).toThrow(/STORAGE_ENDPOINT/)
  })

  it('aggregates every violation into one report', () => {
    /*
     * Scenario: two variables fail at once.
     * Rule it protects: a single thrown error lists BOTH offending variables, so
     * boot surfaces every problem in one pass rather than one-at-a-time.
     */
    const run = () => validateEnv({ PORT: 'x', SCANNER_MODE: 'y' })
    expect(run).toThrow(/PORT/)
    expect(run).toThrow(/SCANNER_MODE/)
  })

  it('never echoes a received value (secret safety)', () => {
    /*
     * Scenario: a valid secret sits beside a failing variable.
     * Rule it protects: the aggregated report carries variable NAMES and issue
     * codes only, so a secret can never leak into logs.
     */
    const secret = 'super-secret-key-value'
    let message = ''
    try {
      validateEnv({ STORAGE_SECRET_ACCESS_KEY: secret, PORT: 'nope' })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toMatch(/PORT/)
    expect(message).not.toContain(secret)
  })

  it('labels a root-level failure as (root)', () => {
    /*
     * Scenario: the whole config is not an object.
     * Rule it protects: an issue with an empty path is labelled `(root)` (the
     * false arm of the path-length branch), not a blank name.
     */
    expect(() => validateEnv(null as unknown as Record<string, unknown>)).toThrow(/\(root\)/)
  })
})

describe('loadEnv', () => {
  it('reads and validates the OS environment under the env namespace', () => {
    /*
     * Scenario: boot invokes the loader against the real OS environment.
     * Rule it protects: loadEnv returns the validated env nested under the `env`
     * key with coerced types, the single sanctioned environment access point.
     */
    const loaded = loadEnv()
    expect(typeof loaded.env.PORT).toBe('number')
    expect(loaded.env.STORAGE_BUCKET.length).toBeGreaterThan(0)
  })
})
