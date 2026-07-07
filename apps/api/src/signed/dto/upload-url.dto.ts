/**
 * @fileoverview Zod schema and inferred type for `POST /signed/upload-url`.
 * A presigned PUT lets a client upload bytes straight to the provider, so the
 * server never sees them: the request only declares the category (for key
 * composition), the exact `Content-Type` the client will send (it becomes part
 * of the SigV4 signature), an advisory `maxSizeBytes` policy, and an optional
 * TTL. Validated by `ZodValidationPipe`.
 * @layer api/signed
 */
import { z } from 'zod'
import { ttlSecondsSchema } from './download-url.dto.js'
import { contentTypeSchema } from './shared.js'

/**
 * Direct-upload categories forming the first key segment. Kept local to the
 * signed surface so the presigned pathway evolves independently of the
 * server-mediated upload categories.
 */
export const SIGNED_UPLOAD_CATEGORIES = ['avatars', 'invoices', 'attachments', 'media'] as const

/** Body schema for `POST /signed/upload-url`. */
export const uploadUrlBodySchema = z.object({
  /** Target category; the server composes `{category}/{uuid}` as the key. */
  category: z.enum(SIGNED_UPLOAD_CATEGORIES),
  /** Exact Content-Type the client must send; folded into the signature. */
  contentType: contentTypeSchema,
  /**
   * Advisory maximum upload size in bytes. NOT bindable at presign time (a SigV4
   * PUT can only pin an exact Content-Length), so it is enforced after the fact
   * by `POST /signed/confirm`. Capped by the server against the configured policy.
   */
  maxSizeBytes: z.number().int().positive().optional(),
  /** Requested lifetime; silently clamped by the library to the configured cap. */
  ttlSeconds: ttlSecondsSchema.optional(),
})

/** Parsed body type for `POST /signed/upload-url`. */
export type UploadUrlBody = z.infer<typeof uploadUrlBodySchema>
