/**
 * @fileoverview Zod schema and inferred type for the idempotent upload endpoint.
 * @layer api/uploads
 */
import { z } from 'zod'

/**
 * Body schema for `POST /uploads/idempotent`. The `content` string is stored
 * as a UTF-8 buffer; the `idempotencyKey` deduplicates within the library's
 * in-memory LRU (spec §12.3).
 */
export const idempotentUploadBodySchema = z.object({
  /**
   * Caller-supplied deduplication key. The library hashes it together with
   * the final object key to form the cache entry.
   */
  idempotencyKey: z.string().min(1),
  /** Text content to store as the object body. */
  content: z.string().min(1),
  /** MIME type for the stored object. */
  contentType: z.string().min(1),
})

/** Parsed body type for `POST /uploads/idempotent`. */
export type IdempotentUploadBody = z.infer<typeof idempotentUploadBodySchema>
