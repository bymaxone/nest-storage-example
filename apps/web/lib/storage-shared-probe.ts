/**
 * @fileoverview Zero-dependency browser-path proof for `@bymax-one/nest-storage`.
 * The web app consumes ONLY the shared subpath (`./shared`) — types and
 * constants carrying no NestJS or AWS-SDK code — and declares NONE of the
 * library's peers. Importing exclusively from `./shared` and referencing every
 * symbol proves the shared entry is self-contained and safe for a browser
 * bundle; the absence of the peers in this package is the proof. Never import
 * the bare server subpath (`@bymax-one/nest-storage`) from this app.
 * @layer Probe
 */
import {
  DEFAULT_IMAGE_MIME_WHITELIST,
  DEFAULT_SIGNED_URL_TTL_SECONDS,
  STORAGE_ERROR_CODES,
  type UploadResult,
} from '@bymax-one/nest-storage/shared'

/**
 * Names the shared constants so the compiler retains the imports and proves the
 * browser-safe subpath resolves. Consumed by nothing at runtime.
 */
export const sharedSubpathResolutionProbe = {
  storageErrorCodes: STORAGE_ERROR_CODES,
  defaultImageMimeWhitelist: DEFAULT_IMAGE_MIME_WHITELIST,
  defaultSignedUrlTtlSeconds: DEFAULT_SIGNED_URL_TTL_SECONDS,
} as const

/**
 * References the shared `UploadResult` type in both parameter and return
 * position so the compiler proves the type export resolves from `./shared`.
 * @param result an upload result described by the shared contract.
 * @returns the same result unchanged.
 */
export const describeUploadResult = (result: UploadResult): UploadResult => result
