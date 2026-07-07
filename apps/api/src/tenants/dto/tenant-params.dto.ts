/**
 * @fileoverview Zod schema for the tenant slug carried in the `:t` route
 * parameter. The slug is composed into every object key, so it is bounded and
 * restricted to lowercase alphanumerics and dashes: that character class alone
 * excludes a path separator (`/`), a parent-directory segment (`..`, the dot is
 * not permitted), and every control character, so a validated slug can never
 * escape its own prefix when composed into `{tenant}/{category}/{uuid}`.
 * @layer api/tenants
 */
import { z } from 'zod'

/**
 * Tenant slug: 2-32 chars, lowercase letters, digits, and dashes only. The
 * character class is the security boundary — no `/`, no `.`, no control chars.
 */
export const tenantSlugSchema = z
  .string()
  .regex(/^[a-z0-9-]{2,32}$/, 'tenant must be 2-32 lowercase alphanumerics or dashes')

/** Parsed tenant slug type. */
export type TenantSlug = z.infer<typeof tenantSlugSchema>
