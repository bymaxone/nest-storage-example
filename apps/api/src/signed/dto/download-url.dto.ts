/**
 * @fileoverview Zod schema and inferred type for `POST /signed/download-url`.
 * Validates the object key (via the shared `objectKeySchema`), an optional TTL,
 * and the two response-header overrides the library folds into the presigned
 * GET signature. Validated by `ZodValidationPipe` before reaching the service.
 * @layer api/signed
 */
import { z } from 'zod'
import { objectKeySchema } from '../../vault/dto/object-key.js'

/**
 * Integer TTL in seconds. Deliberately NOT constrained to positive here: a
 * non-positive value is forwarded to the library so it emits the canonical
 * `STORAGE_SIGNED_URL_TTL_INVALID` envelope, and a value above the configured
 * cap is forwarded so the library's silent clamp stays observable. The schema
 * only rejects non-integers, NaN, and Infinity, which the library never sees.
 */
export const ttlSecondsSchema = z.number().int()

/** Printable ASCII only (space through tilde); rejects CR/LF and control bytes. */
const PRINTABLE_ASCII = /^[\x20-\x7E]+$/

/**
 * Response-header override value: printable ASCII, bounded length. Excluding
 * control characters prevents header/response-splitting injection through the
 * `ResponseContentType` / `ResponseContentDisposition` query parameters.
 */
const headerOverrideSchema = z.string().min(1).max(512).regex(PRINTABLE_ASCII)

/** Body schema for `POST /signed/download-url`. */
export const downloadUrlBodySchema = z.object({
  /** Storage key (raw, before the global keyPrefix); validated by the shared schema. */
  key: objectKeySchema,
  /** Requested lifetime; silently clamped by the library to the configured cap. */
  ttlSeconds: ttlSecondsSchema.optional(),
  /** Overrides the download `Content-Disposition` (e.g. `attachment; filename="a.pdf"`). */
  responseContentDisposition: headerOverrideSchema.optional(),
  /** Overrides the download `Content-Type`. */
  responseContentType: headerOverrideSchema.optional(),
})

/** Parsed body type for `POST /signed/download-url`. */
export type DownloadUrlBody = z.infer<typeof downloadUrlBodySchema>
