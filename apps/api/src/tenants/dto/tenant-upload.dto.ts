/**
 * @fileoverview Zod schema for `POST /tenants/:t/upload`. The tenant demo stores
 * small text bodies so the composed key is the observable subject: a bounded
 * `category` segment (validated with the same slug character class as the tenant
 * so it cannot escape the prefix), the text `content`, and an optional
 * `extension` that becomes the composed key's suffix. The content type is always
 * `text/plain`, which the module MIME whitelist allows, so the upload reaches the
 * provider and the layered key composition is what the demo highlights.
 * @layer api/tenants
 */
import { z } from 'zod'

/** Upper bound on the stored text so a tenant probe stays small. */
const MAX_CONTENT_LENGTH = 65_536

/** Body schema for `POST /tenants/:t/upload`. */
export const tenantUploadBodySchema = z.object({
  /** Logical category folder under the tenant prefix (slug character class). */
  category: z
    .string()
    .regex(/^[a-z0-9-]{1,32}$/, 'category must be 1-32 lowercase alphanumerics or dashes'),
  /** Text content stored under the composed key. */
  content: z.string().min(1).max(MAX_CONTENT_LENGTH),
  /** Optional key suffix (letters/digits only, no dot) appended as `.<extension>`. */
  extension: z
    .string()
    .regex(/^[a-z0-9]{1,8}$/, 'extension must be 1-8 lowercase alphanumerics')
    .optional(),
})

/** Parsed body type for `POST /tenants/:t/upload`. */
export type TenantUploadBody = z.infer<typeof tenantUploadBodySchema>
