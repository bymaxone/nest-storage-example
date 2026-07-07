/**
 * @fileoverview Local view of the resolved validation options the lab reads from
 * the `BYMAX_STORAGE_OPTIONS` token. The library binds its full
 * `ResolvedBymaxStorageOptions` to that token but does not export the type, so
 * this narrows it to exactly the validation block the lab renders: the MIME
 * whitelist, the size cap, and the custom validator chain (each carrying a
 * `name`). Reading from the token guarantees the rendered rules match what the
 * pipeline actually enforces.
 * @layer api/validation-lab
 */
import type { IUploadValidator } from '@bymax-one/nest-storage'

/** The validation policy resolved by the library (every field optional). */
export interface ResolvedValidationPolicy {
  /** MIME whitelist (exact or `type/*` wildcard entries). */
  mimeWhitelist?: readonly string[]
  /** Maximum accepted upload size in bytes. */
  maxSizeBytes?: number
  /** Custom validators run in order; each exposes a stable `name`. */
  customValidators?: readonly IUploadValidator[]
}

/** The subset of the resolved storage options the validation lab depends on. */
export interface ValidationLabPolicyOptions {
  /** Optional validation policy (present in this app's configuration). */
  validation?: ResolvedValidationPolicy
}
