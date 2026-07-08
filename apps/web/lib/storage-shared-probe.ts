/**
 * @fileoverview Zero-dependency browser-path proof for `@bymax-one/nest-storage`.
 * The web app consumes ONLY the shared subpath (`./shared`), which carries
 * types and constants but no NestJS or AWS-SDK code, and declares NONE of the
 * library's peers. Importing exclusively from `./shared` and referencing every
 * symbol proves the shared entry is self-contained and safe for a browser
 * bundle; the absence of the peers in this package is the proof. Never import
 * the bare server subpath (`@bymax-one/nest-storage`) from this app.
 * @layer Probe
 */
import {
  DEFAULT_IMAGE_MIME_WHITELIST,
  DEFAULT_MULTIPART_PART_SIZE_BYTES,
  DEFAULT_MULTIPART_QUEUE_SIZE,
  DEFAULT_SIGNED_URL_TTL_SECONDS,
  DEFAULT_VIDEO_MIME_WHITELIST,
  MAX_SIGNED_URL_TTL_SECONDS,
  STORAGE_ERROR_CODES,
  type UploadResult,
} from '@bymax-one/nest-storage/shared'

/**
 * Names every shared constant so the compiler retains the imports and proves the
 * browser-safe subpath resolves. Naming the full constant surface here also
 * anchors the export-usage audit (`scripts/audit-library-exports.mjs`) for the
 * shared tuning defaults the dashboard reads but does not override. Consumed by
 * nothing at runtime.
 */
export const sharedSubpathResolutionProbe = {
  storageErrorCodes: STORAGE_ERROR_CODES,
  defaultImageMimeWhitelist: DEFAULT_IMAGE_MIME_WHITELIST,
  defaultVideoMimeWhitelist: DEFAULT_VIDEO_MIME_WHITELIST,
  defaultSignedUrlTtlSeconds: DEFAULT_SIGNED_URL_TTL_SECONDS,
  maxSignedUrlTtlSeconds: MAX_SIGNED_URL_TTL_SECONDS,
  defaultMultipartPartSizeBytes: DEFAULT_MULTIPART_PART_SIZE_BYTES,
  defaultMultipartQueueSize: DEFAULT_MULTIPART_QUEUE_SIZE,
} as const

/**
 * References the shared `UploadResult` type in both parameter and return
 * position so the compiler proves the type export resolves from `./shared`.
 * @param result an upload result described by the shared contract.
 * @returns the same result unchanged.
 */
export const describeUploadResult = (result: UploadResult): UploadResult => result
