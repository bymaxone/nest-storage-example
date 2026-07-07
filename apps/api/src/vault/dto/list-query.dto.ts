/**
 * @fileoverview Zod schema and types for the `GET /vault` listing endpoint.
 * Validates prefix, maxKeys, cursor (continuationToken), and the optional
 * delimiter for pseudo-folder aggregation (spec §11.1).
 * @layer api/vault
 */
import { z } from 'zod'

/**
 * Query schema for `GET /vault`. All fields are optional; `maxKeys` coerces
 * the query-string number with a 1-1000 range; `delimiter` is locked to `'/'`
 * (the only delimiter that produces meaningful folder aggregation over S3).
 */
export const listQuerySchema = z.object({
  /** Optional filter prefix applied after the global key prefix (max 1024 bytes, the S3 key limit). */
  prefix: z.string().max(1024).optional(),
  /** Maximum objects per page (1-1000, defaults to 50). */
  maxKeys: z.coerce.number().int().min(1).max(1000).default(50),
  /** Continuation token from a prior page (maps to S3 `ContinuationToken`; bounded to 1024 bytes). */
  cursor: z.string().max(1024).optional(),
  /** When `'/'`, sub-prefixes are aggregated into `commonPrefixes`. */
  delimiter: z.literal('/').optional(),
})

/** Parsed query type for `GET /vault`. */
export type ListQuery = z.infer<typeof listQuerySchema>
