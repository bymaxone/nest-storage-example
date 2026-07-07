/**
 * @fileoverview The exhaustive error catalogue. Every entry is keyed off the
 * shipped `STORAGE_ERROR_CODES` and its HTTP status + default message are read
 * from the library's own `StorageException` (constructed for introspection only,
 * never thrown here) so the table can never drift from what the library maps.
 *
 * Reconciliation note (drift vs spec §18): the shipped library exports 18 codes;
 * spec §18 documents 17. Spec omits `STORAGE_INVALID_PART_COUNT` (thrown by
 * `getMultipartUploadUrls` when `parts <= 0`). Two shipped codes are defined but
 * NOT reproducible through the library's public surface, so they are flagged
 * `reproducible: false`:
 *   - `STORAGE_PART_TOO_SMALL`: no public code path guards part size; a real
 *     sub-5 MiB non-final part surfaces as the provider's `EntityTooSmall`, which
 *     the library maps to `STORAGE_PROVIDER_ERROR`.
 *   - `STORAGE_TIMEOUT`: `requestTimeoutMs` is resolved in options but never wired
 *     into the S3 client request handler, so no library-issued request can raise
 *     the `TimeoutError` this code maps from.
 * The catalogue is exhaustive over the shipped 18; the other 16 codes are
 * reproduced deterministically on demand.
 * @layer api/errors-demo
 */
import { STORAGE_ERROR_CODES, StorageException } from '@bymax-one/nest-storage'
import type { StorageErrorCode } from '@bymax-one/nest-storage'
import type { StorageErrorResponse } from '@bymax-one/nest-storage/shared'

/** Trigger recipe text and reproducibility for a single error code. */
interface CodeMeta {
  /** Short, human-readable recipe describing how the code is reproduced. */
  trigger: string
  /** `false` only for a defined-but-unthrown code (documented drift). */
  reproducible: boolean
}

/** One rendered catalogue row. */
export interface CatalogueEntry {
  /** The stable storage error code. */
  code: StorageErrorCode
  /** The HTTP status the library maps this code to. */
  status: number
  /** The library's default message for this code. */
  message: string
  /** How `POST /errors/:code` reproduces this code. */
  trigger: string
  /** Whether the shipped library can actually throw this code on demand. */
  reproducible: boolean
}

/** The per-code recipe + reproducibility metadata (single source of trigger truth). */
const CODE_META: Record<StorageErrorCode, CodeMeta> = {
  STORAGE_NOT_CONFIGURED: {
    trigger:
      'A scoped module instance built with empty credentials; any operation asserts configuration first.',
    reproducible: true,
  },
  STORAGE_KEY_INVALID: {
    trigger: 'An upload whose key contains a `..` traversal segment; the key resolver rejects it.',
    reproducible: true,
  },
  STORAGE_BODY_MISSING: {
    trigger: 'An upload call with no body.',
    reproducible: true,
  },
  STORAGE_CONTENT_TYPE_REQUIRED: {
    trigger: 'An upload call with an empty content type.',
    reproducible: true,
  },
  STORAGE_MIME_NOT_ALLOWED: {
    trigger: 'An upload of `application/zip` against the module MIME whitelist.',
    reproducible: true,
  },
  STORAGE_SIZE_EXCEEDED: {
    trigger: 'An upload whose declared size exceeds the configured `maxSizeBytes`.',
    reproducible: true,
  },
  STORAGE_VALIDATION_FAILED: {
    trigger:
      'A body declared `application/pdf` without the `%PDF` magic bytes; the custom validator rejects it.',
    reproducible: true,
  },
  STORAGE_SCAN_INFECTED: {
    trigger: 'A body carrying the inert `X-DEMO-INFECTED` marker; the scanner reports infected.',
    reproducible: true,
  },
  STORAGE_SCAN_INCONCLUSIVE: {
    trigger: 'A scoped instance with `rejectOnUnknown: true` scanning an `X-DEMO-UNKNOWN` body.',
    reproducible: true,
  },
  STORAGE_OBJECT_NOT_FOUND: {
    trigger: 'A head() on a key that does not exist.',
    reproducible: true,
  },
  STORAGE_PROVIDER_ERROR: {
    trigger:
      'A scoped instance pointed at the real endpoint with wrong credentials; the provider rejects with 403.',
    reproducible: true,
  },
  STORAGE_SIGNED_URL_TTL_INVALID: {
    trigger: 'A signed download URL requested with `ttlSeconds: 0`.',
    reproducible: true,
  },
  STORAGE_PART_TOO_SMALL: {
    trigger:
      'DEFINED BUT NOT THROWN by the shipped library: no public method guards part size. A real sub-5 MiB non-final part surfaces from the provider as EntityTooSmall, which the library maps to STORAGE_PROVIDER_ERROR.',
    reproducible: false,
  },
  STORAGE_INVALID_PART_COUNT: {
    trigger: 'A presigned multipart request with `parts: 0`.',
    reproducible: true,
  },
  STORAGE_BUCKET_UNDEFINED: {
    trigger: 'A head() call with an empty per-call bucket override and no default.',
    reproducible: true,
  },
  STORAGE_MULTIPART_ABORTED: {
    trigger:
      'A wrong-credentials scoped instance forced onto the multipart path (unknown-size stream); CreateMultipartUpload fails and the upload aborts.',
    reproducible: true,
  },
  STORAGE_INVALID_CONFIG: {
    trigger: 'A `BymaxStorageModule.forRoot({})` probe with missing required options.',
    reproducible: true,
  },
  STORAGE_TIMEOUT: {
    trigger:
      'DEFINED BUT NOT REPRODUCIBLE via the shipped library: `requestTimeoutMs` is resolved in options but never wired into the S3 client request handler, so the SDK issues no request/connection timeout and never emits the TimeoutError that STORAGE_TIMEOUT maps from. A real timeout needs a request-handler timeout the library does not expose.',
    reproducible: false,
  },
}

/**
 * Builds the exhaustive catalogue over every shipped `STORAGE_ERROR_CODES`,
 * reading the HTTP status and default message from the library's own
 * `StorageException` so the table cannot drift from the library's mapping.
 *
 * @returns One entry per shipped error code.
 */
export function buildCatalogue(): CatalogueEntry[] {
  return Object.values(STORAGE_ERROR_CODES).map((code) => {
    const exception = new StorageException(code)
    const body = exception.getResponse() as StorageErrorResponse
    return {
      code,
      status: exception.getStatus(),
      message: body.error.message,
      trigger: CODE_META[code].trigger,
      reproducible: CODE_META[code].reproducible,
    }
  })
}
