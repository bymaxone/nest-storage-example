/**
 * @fileoverview Zod schemas and inferred types for the vault download endpoints.
 * Covers stream download, buffer preview, byte-range, and versioned retrieval.
 * @layer api/vault
 */
import { z } from 'zod'

/**
 * Query schema shared by most vault download routes: the object `key` is
 * required and identifies the storage object to retrieve.
 */
export const downloadQuerySchema = z.object({
  /** Storage key (URL-decoded by Express before reaching the schema). */
  key: z.string().min(1),
})

/** Parsed query type for download routes that accept only a key. */
export type DownloadQuery = z.infer<typeof downloadQuerySchema>

/**
 * Query schema for `GET /vault/object/range`. Adds `start` and `end` byte
 * offsets to the base key query. Both are coerced from query-string strings
 * to non-negative integers.
 */
export const rangeQuerySchema = downloadQuerySchema.extend({
  /** Byte offset of the first byte to return (inclusive, zero-based). */
  start: z.coerce.number().int().min(0),
  /** Byte offset of the last byte to return (inclusive). */
  end: z.coerce.number().int().min(0),
})

/** Parsed query type for `GET /vault/object/range`. */
export type RangeQuery = z.infer<typeof rangeQuerySchema>

/**
 * Query schema for `GET /vault/object/version`. Adds a required `versionId`
 * to the base key query, targeting a specific object version in the versioned
 * bucket.
 */
export const versionQuerySchema = downloadQuerySchema.extend({
  /** S3 version identifier returned by a prior upload to the versioned bucket. */
  versionId: z.string().min(1),
})

/** Parsed query type for `GET /vault/object/version`. */
export type VersionQuery = z.infer<typeof versionQuerySchema>
