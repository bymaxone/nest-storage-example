/**
 * @fileoverview Zod schemas and inferred types for the single-shot and
 * SSE-override upload endpoints. Validated via `ZodValidationPipe` before
 * reaching the service.
 * @layer api/uploads
 */
import { z } from 'zod'

/** Allowed upload category values (forms the first key segment). */
export const UPLOAD_CATEGORIES = ['avatars', 'invoices', 'attachments', 'media'] as const

/** Inferred union of allowed category strings. */
export type UploadCategory = (typeof UPLOAD_CATEGORIES)[number]

/**
 * Body schema for `POST /uploads/single`. The `file` field is handled
 * separately by the `FileInterceptor` decorator; this schema covers the
 * remaining form fields.
 */
export const singleUploadBodySchema = z.object({
  /** Target category for key composition. */
  category: z.enum(UPLOAD_CATEGORIES),
  /** Optional `Cache-Control` override for this upload. */
  cacheControl: z.string().optional(),
  /**
   * Optional `Content-Disposition` override. Accepts `'inline'`,
   * `'attachment'`, or any full header value.
   */
  contentDisposition: z.string().optional(),
  /**
   * Optional `x-amz-meta-*` metadata pairs. Every key is sent as
   * `x-amz-meta-{key}` on the stored object.
   */
  metadata: z.record(z.string(), z.string()).optional(),
})

/** Parsed body type for `POST /uploads/single`. */
export type SingleUploadBody = z.infer<typeof singleUploadBodySchema>

/** Allowed server-side encryption algorithm values, including the `'NONE'` sentinel. */
export const SSE_VALUES = ['AES256', 'aws:kms', 'NONE'] as const

/**
 * Body schema for `POST /uploads/sse-override`. Includes the SSE field in
 * addition to the base single-upload fields.
 */
export const sseOverrideBodySchema = singleUploadBodySchema.extend({
  /**
   * Per-upload SSE algorithm. Pass `'NONE'` to force no encryption even when
   * a default is configured at the module level (spec §12.1).
   */
  serverSideEncryption: z.enum(SSE_VALUES),
})

/** Parsed body type for `POST /uploads/sse-override`. */
export type SseOverrideBody = z.infer<typeof sseOverrideBodySchema>
