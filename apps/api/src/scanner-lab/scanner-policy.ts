/**
 * @fileoverview Local view of the resolved scanner options the lab reads from the
 * `BYMAX_STORAGE_OPTIONS` token. The library binds its full
 * `ResolvedBymaxStorageOptions` to that token but does not export the type, so
 * this narrows it to exactly the scanner block the lab introspects: the resolved
 * mode and the `rejectOnUnknown` flag. Reading from the token guarantees the
 * rendered config matches what the pipeline actually enforces (the library
 * resolves the mode once, at module registration).
 * @layer api/scanner-lab
 */

/** The scanner policy resolved by the library (mode defaults to pre-upload). */
export interface ResolvedScannerPolicy {
  /** `'pre-upload'` scans before the PutObject; `'post-upload'` scans after. */
  mode?: 'pre-upload' | 'post-upload'
  /** Rejects an `unknown` verdict when true; otherwise it passes with a warning. */
  rejectOnUnknown?: boolean
}

/** The subset of the resolved storage options the scanner lab depends on. */
export interface ScannerLabPolicyOptions {
  /** Optional scanner policy (present in this app's configuration). */
  scanner?: ResolvedScannerPolicy
}
