/**
 * @fileoverview Zod schema and inferred type for the `GET /scanner/exists`
 * query. Reuses the shared `objectKeySchema` so the existence probe validates a
 * key identically to the rest of the app. The probe backs the post-upload
 * removal proof: after an infected object is uploaded-then-removed by the
 * library, `exists` reports `false` for its key.
 * @layer api/scanner-lab
 */
import { z } from 'zod'
import { objectKeySchema } from '../../vault/dto/object-key.js'

/** Query schema for `GET /scanner/exists`. */
export const scannerExistsQuerySchema = z.object({
  /** The raw object key to probe (the library prepends the global prefix). */
  key: objectKeySchema,
})

/** Parsed query type for `GET /scanner/exists`. */
export type ScannerExistsQuery = z.infer<typeof scannerExistsQuerySchema>
