/**
 * Unit: buildStorageOptions - the canonical env-to-options mapping (spec §9.2).
 *
 * Asserts every configuration block is populated from the validated env, and
 * exercises both arms of the two conditional spreads (`cdnBaseUrl` and
 * `serverSideEncryption`): a default env omits them; an env with a CDN base and
 * an SSE algorithm includes them.
 *
 * @module config/storage.config.spec
 */
import {
  DEFAULT_DOC_MIME_WHITELIST,
  DEFAULT_IMAGE_MIME_WHITELIST,
} from '@bymax-one/nest-storage/shared'
import { envSchema } from './env.schema.js'
import { buildStorageOptions } from './storage.config.js'
import { PdfMagicByteValidator } from '../validation-lab/pdf-magic-byte.validator.js'
import { MarkerFileScanner } from '../scanner-lab/marker-file.scanner.js'

describe('buildStorageOptions', () => {
  it('maps every configuration block from the default environment', () => {
    /*
     * Scenario: the default (MinIO dev) environment is wired.
     * Rule it protects: connection, credentials, key prefix, header defaults, the
     * reduced signed-URL cap, multipart knobs, the validation pipeline (shared
     * whitelists + video wildcard + magic-byte validator), the marker scanner,
     * the checksum mode, and the network knobs all map from env verbatim.
     */
    const env = envSchema.parse({})

    const options = buildStorageOptions(env)

    expect(options.endpoint).toBe('http://localhost:9000')
    expect(options.region).toBe('us-east-1')
    expect(options.bucket).toBe('vault')
    expect(options.credentials).toEqual({
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
    })
    expect(options.forcePathStyle).toBe(true)
    expect(options.publicBaseUrl).toBe('http://localhost:9000/vault')
    expect(options.keyPrefix).toBe('storage-example')
    expect(options.defaultCacheControl).toBe('public, max-age=31536000, immutable')
    expect(options.defaultContentDisposition).toBe('inline')
    expect(options.signedUrls).toEqual({
      defaultGetTtlSeconds: 300,
      defaultPutTtlSeconds: 300,
      maxTtlSeconds: 3600,
    })
    expect(options.multipart).toEqual({
      thresholdBytes: 5_242_880,
      partSizeBytes: 5_242_880,
      queueSize: 4,
    })
    expect(options.validation?.maxSizeBytes).toBe(26_214_400)
    expect(options.validation?.mimeWhitelist).toEqual([
      ...DEFAULT_IMAGE_MIME_WHITELIST,
      ...DEFAULT_DOC_MIME_WHITELIST,
      'video/*',
    ])
    expect(options.validation?.customValidators?.[0]).toBeInstanceOf(PdfMagicByteValidator)
    expect(options.scanner?.impl).toBeInstanceOf(MarkerFileScanner)
    expect(options.scanner?.mode).toBe('pre-upload')
    expect(options.scanner?.rejectOnUnknown).toBe(false)
    expect(options.requestChecksumCalculation).toBe('WHEN_REQUIRED')
    expect(options.responseChecksumValidation).toBe('WHEN_REQUIRED')
    expect(options.maxAttempts).toBe(3)
    expect(options.requestTimeoutMs).toBe(30_000)
  })

  it('omits cdnBaseUrl and serverSideEncryption when their env vars are empty', () => {
    /*
     * Scenario: the default env leaves the CDN base and SSE algorithm unset.
     * Rule it protects: the conditional spreads take their "off" arm, so neither
     * optional field is present (never an explicit `undefined`).
     */
    const options = buildStorageOptions(envSchema.parse({}))

    expect('cdnBaseUrl' in options).toBe(false)
    expect('serverSideEncryption' in options).toBe(false)
  })

  it('includes cdnBaseUrl and serverSideEncryption when configured', () => {
    /*
     * Scenario: a CDN base and an SSE algorithm are provided.
     * Rule it protects: the conditional spreads take their "on" arm, folding both
     * optional fields into the options.
     */
    const env = envSchema.parse({
      STORAGE_CDN_BASE_URL: 'https://cdn.example.com',
      STORAGE_SSE: 'AES256',
    })

    const options = buildStorageOptions(env)

    expect(options.cdnBaseUrl).toBe('https://cdn.example.com')
    expect(options.serverSideEncryption).toBe('AES256')
  })
})
