/**
 * @fileoverview Builds the resolved `BymaxStorageModuleOptions` from the
 * validated environment. This is THE copy-paste artifact of the repo: one place
 * that exercises every configuration block of `@bymax-one/nest-storage` -
 * connection, key prefix, header defaults, signed-URL policy, multipart
 * thresholds, the validation pipeline, the scanner hook, checksum mode, and the
 * network knobs (spec §9.2).
 * @layer api/config
 */
import type { BymaxStorageModuleOptions } from '@bymax-one/nest-storage'
import {
  DEFAULT_DOC_MIME_WHITELIST,
  DEFAULT_IMAGE_MIME_WHITELIST,
} from '@bymax-one/nest-storage/shared'
import type { Env } from './env.schema.js'
import { PdfMagicByteValidator } from '../validation-lab/pdf-magic-byte.validator.js'
import { MarkerFileScanner } from '../scanner-lab/marker-file.scanner.js'

/**
 * Maps the validated environment onto the library options, wiring every
 * configuration block the example demonstrates. Optional blocks (`cdnBaseUrl`,
 * `serverSideEncryption`) are folded in via conditional spreads so an unset env
 * var omits the field entirely rather than passing an explicit `undefined`.
 *
 * @param env - The Zod-validated environment.
 * @returns The fully-populated storage module options.
 */
export const buildStorageOptions = (env: Env): BymaxStorageModuleOptions => ({
  endpoint: env.STORAGE_ENDPOINT,
  region: env.STORAGE_REGION,
  bucket: env.STORAGE_BUCKET,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  },
  forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
  publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
  ...(env.STORAGE_CDN_BASE_URL ? { cdnBaseUrl: env.STORAGE_CDN_BASE_URL } : {}),
  keyPrefix: env.STORAGE_KEY_PREFIX,
  defaultCacheControl: 'public, max-age=31536000, immutable',
  defaultContentDisposition: 'inline',
  signedUrls: {
    defaultGetTtlSeconds: 300,
    defaultPutTtlSeconds: 300,
    // Deliberately reduced from the 604800 s SigV4 cap so the clamp demo is visible.
    maxTtlSeconds: env.STORAGE_MAX_TTL_SECONDS,
  },
  multipart: {
    thresholdBytes: env.STORAGE_MULTIPART_THRESHOLD,
    partSizeBytes: 5_242_880,
    queueSize: 4,
  },
  validation: {
    mimeWhitelist: [...DEFAULT_IMAGE_MIME_WHITELIST, ...DEFAULT_DOC_MIME_WHITELIST, 'video/*'],
    maxSizeBytes: env.UPLOAD_MAX_SIZE_BYTES,
    customValidators: [new PdfMagicByteValidator()],
  },
  scanner: {
    impl: new MarkerFileScanner(),
    mode: env.SCANNER_MODE,
    rejectOnUnknown: env.SCANNER_REJECT_ON_UNKNOWN,
  },
  ...(env.STORAGE_SSE ? { serverSideEncryption: env.STORAGE_SSE } : {}),
  // MinIO (and R2/B2/Spaces) reject the SDK's default CRC32 integrity headers.
  requestChecksumCalculation: env.STORAGE_CHECKSUM_MODE,
  responseChecksumValidation: env.STORAGE_CHECKSUM_MODE,
  maxAttempts: 3,
  requestTimeoutMs: 30_000,
})
