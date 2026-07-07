/**
 * @fileoverview Zod schema and types for the `POST /vault/bulk-delete` body.
 * Validates the `keys` array: 1 to 1000 non-empty strings, matching the S3
 * DeleteObjects API hard limit. Batching beyond 1000 is the client's
 * responsibility (spec §11.1).
 * @layer api/vault
 */
import { z } from 'zod'
import { objectKeySchema } from './object-key.js'

/**
 * Body schema for `POST /vault/bulk-delete`. Accepts 1 to 1000 keys.
 * Each key is validated by the shared `objectKeySchema` (non-empty, max 1024
 * bytes, no control characters). Requests with 0 or more than 1000 keys are
 * rejected at the schema level so they never reach the service.
 */
export const bulkDeleteBodySchema = z.object({
  /** Keys to delete. Must contain 1 to 1000 valid object keys. */
  keys: z
    .array(objectKeySchema)
    .min(1, 'At least one key is required.')
    .max(1000, 'Batches above 1000 keys must be split by the caller (S3 hard cap).'),
})

/** Parsed body type for `POST /vault/bulk-delete`. */
export type BulkDeleteBody = z.infer<typeof bulkDeleteBodySchema>
