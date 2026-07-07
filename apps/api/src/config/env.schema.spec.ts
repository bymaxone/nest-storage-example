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

describe('explicit string constraints', () => {
  it('accepts multi-character values for the endpoint, region, and bucket fields', () => {
    /*
     * Scenario: an operator supplies explicit, multi-character values for the
     * string fields (rather than relying on the defaults, which skip re-validation).
     * Rule it protects: the length/URL constraints admit real values longer than a
     * single character, so a mutant that shrinks a `.min`/`.url` constraint to
     * `.max(1)` would reject these and is caught.
     */
    const parsed = envSchema.parse({
      STORAGE_ENDPOINT: 'http://storage.example:9000',
      STORAGE_REGION: 'eu-west-1',
      STORAGE_BUCKET: 'primary-bucket',
      STORAGE_ARCHIVE_BUCKET: 'archive-bucket',
      STORAGE_VERSIONED_BUCKET: 'versioned-bucket',
    })

    expect(parsed.STORAGE_ENDPOINT).toBe('http://storage.example:9000')
    expect(parsed.STORAGE_REGION).toBe('eu-west-1')
    expect(parsed.STORAGE_BUCKET).toBe('primary-bucket')
    expect(parsed.STORAGE_ARCHIVE_BUCKET).toBe('archive-bucket')
    expect(parsed.STORAGE_VERSIONED_BUCKET).toBe('versioned-bucket')
  })
})

describe('optional CDN and SSE unions', () => {
  it('accepts an explicit empty string and a valid URL for the CDN base', () => {
    /*
     * Scenario: the CDN base is supplied explicitly as "" (the "no CDN" state) and,
     * separately, as a real URL.
     * Rule it protects: the union's empty-string LITERAL is `''` exactly, so a
     * mutant that swaps the literal for other text would reject the "no CDN" state
     * (which relies on defaults skipping re-validation otherwise).
     */
    expect(envSchema.parse({ STORAGE_CDN_BASE_URL: '' }).STORAGE_CDN_BASE_URL).toBe('')
    expect(
      envSchema.parse({ STORAGE_CDN_BASE_URL: 'https://cdn.example.com' }).STORAGE_CDN_BASE_URL,
    ).toBe('https://cdn.example.com')
  })

  it('accepts each SSE algorithm and the explicit "no SSE" empty string', () => {
    /*
     * Scenario: STORAGE_SSE is supplied as each allowed algorithm and as "".
     * Rule it protects: the enum members are exactly `'AES256'` and `'aws:kms'`, so
     * a mutant that blanks either enum literal would reject that algorithm.
     */
    expect(envSchema.parse({ STORAGE_SSE: 'AES256' }).STORAGE_SSE).toBe('AES256')
    expect(envSchema.parse({ STORAGE_SSE: 'aws:kms' }).STORAGE_SSE).toBe('aws:kms')
    expect(envSchema.parse({ STORAGE_SSE: '' }).STORAGE_SSE).toBe('')
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
    // The two issue lines are joined by a newline (never concatenated), so the report
    // splits into the prefix line plus one line per violation. A mutant that blanks
    // the line separator would collapse both violations onto a single line.
    let message = ''
    try {
      run()
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message.split('\n')).toHaveLength(3)
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

  it('renders a non-custom issue by its code alone, without a parenthetical message', () => {
    /*
     * Scenario: a plain (non-custom) validation failure, e.g. a non-numeric PORT.
     * Rule it protects: only custom-guard issues append `(message)`; every other
     * issue is reported by code ONLY, so no Zod message text (which could echo
     * input) leaks. A mutant that always appends the parenthetical is caught.
     */
    let message = ''
    try {
      validateEnv({ PORT: 'not-a-number' })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toMatch(/PORT/)
    expect(message).not.toMatch(/PORT: \w+ \(/)
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

describe('production credential guard', () => {
  it('fails when production still carries the dev-default credentials', () => {
    /*
     * Scenario: NODE_ENV=production while both credentials keep the well-known
     * minioadmin default (the value applied when the vars are absent).
     * Rule it protects: the cross-field guard rejects the boot and names BOTH
     * offending credentials so the dev password can never reach a public deploy.
     */
    const run = () => validateEnv({ NODE_ENV: 'production' })
    expect(run).toThrow(/STORAGE_ACCESS_KEY_ID/)
    expect(run).toThrow(/STORAGE_SECRET_ACCESS_KEY/)
  })

  it('formats a custom guard issue as "custom (message)" under the config-error prefix', () => {
    /*
     * Scenario: a production boot trips the dev-credential guard.
     * Rule it protects: the aggregated report opens with the fixed
     * "Invalid environment configuration:" prefix and renders each custom guard
     * issue as `custom (<value-free message>)`, so the code-vs-custom branch and
     * the literal detail text are pinned.
     */
    let message = ''
    try {
      validateEnv({ NODE_ENV: 'production' })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toMatch(/^Invalid environment configuration:/)
    // The offending credential is labelled by its own path (the `path: [name]`
    // issue), so the line reads `<NAME>: custom (...)` rather than `(root): ...`.
    expect(message).toContain('STORAGE_ACCESS_KEY_ID: custom (')
    expect(message).toContain('STORAGE_SECRET_ACCESS_KEY: custom (')
    expect(message).toContain(
      'custom (STORAGE_ACCESS_KEY_ID must not use the dev default in production)',
    )
    expect(message).toContain(
      'custom (STORAGE_SECRET_ACCESS_KEY must not use the dev default in production)',
    )
  })

  it('passes when production supplies real credentials', () => {
    /*
     * Scenario: NODE_ENV=production with genuine, overridden credentials.
     * Rule it protects: the guard only triggers on the dev default, so a properly
     * configured production environment validates and returns the typed env.
     */
    const env = validateEnv({
      NODE_ENV: 'production',
      STORAGE_ACCESS_KEY_ID: 'AKIAREALACCESSKEY',
      STORAGE_SECRET_ACCESS_KEY: 'a-real-production-secret',
    })
    expect(env.NODE_ENV).toBe('production')
    expect(env.STORAGE_ACCESS_KEY_ID).toBe('AKIAREALACCESSKEY')
  })

  it('allows the dev-default credentials outside production', () => {
    /*
     * Scenario: development boot with the minioadmin defaults intact.
     * Rule it protects: the guard's non-production early return keeps the local
     * convenience defaults valid so dev needs no credential configuration.
     */
    const env = validateEnv({ NODE_ENV: 'development' })
    expect(env.STORAGE_ACCESS_KEY_ID).toBe('minioadmin')
    expect(env.STORAGE_SECRET_ACCESS_KEY).toBe('minioadmin')
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
