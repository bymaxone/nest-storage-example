/**
 * @fileoverview Zod schema and types for the `POST /vault/copy` body.
 * Covers same-bucket rename and cross-bucket archive copy, with an optional
 * `deleteSource` flag to complete the rename pattern (spec §11.1, §15).
 * @layer api/vault
 */
import { z } from 'zod'
import { objectKeySchema } from './object-key.js'

/**
 * Body schema for `POST /vault/copy`. `destination` selects the target bucket:
 * `'same'` copies within the default vault bucket; `'archive'` targets the
 * `vault-archive` bucket. The optional `deleteSource` flag deletes the source
 * after a successful copy, implementing the rename pattern.
 */
export const copyBodySchema = z.object({
  /** The raw key of the object to copy. */
  sourceKey: objectKeySchema,
  /** The raw key of the new object. */
  destinationKey: objectKeySchema,
  /** `'same'` copies within the vault bucket; `'archive'` targets vault-archive. */
  destination: z.enum(['same', 'archive']),
  /** When `true`, the source is deleted after a successful copy (rename pattern). */
  deleteSource: z.boolean().optional(),
})

/** Parsed body type for `POST /vault/copy`. */
export type CopyBody = z.infer<typeof copyBodySchema>
