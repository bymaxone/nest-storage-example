/**
 * @fileoverview Zod schema for the `GET /tenants/:t/objects` query. Callers may
 * narrow to a `category` sub-prefix and page with a `cursor`; `maxKeys` bounds
 * the page. Every value is optional so a bare listing returns the whole tenant.
 * @layer api/tenants
 */
import { z } from 'zod'

/** Upper bound on a single listing page (mirrors the S3 hard maximum). */
const MAX_KEYS_LIMIT = 1000

/** Query schema for `GET /tenants/:t/objects`. */
export const tenantListQuerySchema = z.object({
  /** Optional category sub-prefix (slug character class) to narrow the listing. */
  category: z
    .string()
    .regex(/^[a-z0-9-]{1,32}$/, 'category must be 1-32 lowercase alphanumerics or dashes')
    .optional(),
  /** Continuation token from a previous page. */
  cursor: z.string().min(1).optional(),
  /** Page size (1-1000). */
  maxKeys: z.coerce.number().int().positive().max(MAX_KEYS_LIMIT).optional(),
})

/** Parsed query type for `GET /tenants/:t/objects`. */
export type TenantListQuery = z.infer<typeof tenantListQuerySchema>
