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
/** Basic MIME type pattern: type/subtype with ASCII token characters. */
const MIME_TYPE_RE = /^[a-zA-Z0-9!#$&\-^_.+]+\/[a-zA-Z0-9!#$&\-^_.+]+$/

export const idempotentUploadBodySchema = z.object({
  /**
   * Caller-supplied deduplication key. The library hashes it together with
   * the final object key to form the cache entry. Max 256 chars.
   */
  idempotencyKey: z.string().min(1).max(256),
  /** Text content to store as the object body. Max 64 KiB encoded. */
  content: z.string().min(1).max(65_536),
  /** MIME type for the stored object. Must match `type/subtype`. */
  contentType: z.string().min(1).max(128).regex(MIME_TYPE_RE),
})

/** Parsed body type for `POST /uploads/idempotent`. */
export type IdempotentUploadBody = z.infer<typeof idempotentUploadBodySchema>
