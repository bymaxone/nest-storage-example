/**
 * @fileoverview Zod schemas and inferred types for the presigned multipart
 * endpoints: issuance (`POST /signed/multipart-urls`) and abort
 * (`POST /signed/multipart-abort`). Validated by `ZodValidationPipe`.
 * @layer api/signed
 */
import { z } from 'zod'
import { objectKeySchema } from '../../vault/dto/object-key.js'
import { ttlSecondsSchema } from './download-url.dto.js'
import { SIGNED_UPLOAD_CATEGORIES } from './upload-url.dto.js'
import { PRINTABLE_ASCII, contentTypeSchema } from './shared.js'

/**
 * Maximum parts presigned in one request. S3 allows up to 10000 parts per
 * upload; the reference app caps issuance at 1000 to keep a single response
 * bounded (each part is one presigned URL).
 */
export const MAX_MULTIPART_PARTS = 1000

/** Body schema for `POST /signed/multipart-urls`. */
export const multipartUrlsBodySchema = z.object({
  /** Target category; the server composes `{category}/{uuid}` as the key. */
  category: z.enum(SIGNED_UPLOAD_CATEGORIES),
  /** Content-Type applied to the created multipart object. */
  contentType: contentTypeSchema,
  /** Number of part URLs to presign (1-indexed on return). */
  parts: z.number().int().min(1).max(MAX_MULTIPART_PARTS),
  /** Requested lifetime; silently clamped by the library to the configured cap. */
  ttlSeconds: ttlSecondsSchema.optional(),
})

/** Parsed body type for `POST /signed/multipart-urls`. */
export type MultipartUrlsBody = z.infer<typeof multipartUrlsBodySchema>

/** Body schema for `POST /signed/multipart-abort`. */
export const multipartAbortBodySchema = z.object({
  /** Key of the in-progress multipart upload. */
  key: objectKeySchema,
  /** The `uploadId` returned by a prior `multipart-urls` issuance. */
  uploadId: z.string().min(1).max(1024).regex(PRINTABLE_ASCII),
})

/** Parsed body type for `POST /signed/multipart-abort`. */
export type MultipartAbortBody = z.infer<typeof multipartAbortBodySchema>
