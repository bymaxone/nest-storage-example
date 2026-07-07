/**
 * @fileoverview The confirm-time scanner seam. A direct presigned PUT bypasses
 * the server-side validation and scanner pipeline by design, so the object that
 * lands is unverified. `POST /signed/confirm` closes that gap: it re-checks size
 * and MIME against the configured policy and asks an `IConfirmScanner` for a
 * threat verdict. This module defines the seam (interface + DI token + a no-op
 * default). The real content scanner replaces the bound provider once the
 * scanner-verify wiring lands (spec §16); the seam exists now so confirm never
 * silently trusts a direct upload.
 * @layer api/signed
 */

/** Outcome of a confirm-time scan of a landed object. */
export interface ScanVerdict {
  /**
   * `clean` = scanned, no threat; `infected` = a threat was found;
   * `unknown` = the scanner could not decide; `skipped` = no scanner is wired
   * (the no-op default), so the object was not inspected.
   */
  status: 'clean' | 'infected' | 'unknown' | 'skipped'
  /** Threat name when `status === 'infected'`; omitted otherwise. */
  threat?: string
}

/**
 * Contract for a confirm-time scanner. Implementations inspect an already-landed
 * object (identified by key + bucket) and return a verdict. Bound to
 * `CONFIRM_SCANNER` so the default can be swapped without touching the service.
 */
export interface IConfirmScanner {
  /**
   * Scans a landed object and returns its threat verdict.
   *
   * @param key - The normalized object key to scan.
   * @param bucket - The bucket the object resides in.
   * @returns The scan verdict.
   */
  scan(key: string, bucket: string): Promise<ScanVerdict>
}

/**
 * DI token for the confirm-time scanner. A `Symbol` (not a string) so the
 * binding cannot collide with another provider token.
 */
export const CONFIRM_SCANNER = Symbol('CONFIRM_SCANNER')

/**
 * Default confirm scanner: inspects nothing and reports `skipped`. It makes the
 * bypass boundary explicit rather than implying a direct upload was scanned.
 * The real scanner provider replaces this binding when scanner-verify is wired
 * (spec §16).
 */
export class NoOpConfirmScanner implements IConfirmScanner {
  /**
   * Returns a `skipped` verdict without inspecting the object. The key and
   * bucket parameters of `IConfirmScanner.scan` are intentionally omitted here
   * since the no-op inspects nothing (a narrower implementation still satisfies
   * the contract).
   *
   * @returns A resolved `{ status: 'skipped' }` verdict.
   */
  scan(): Promise<ScanVerdict> {
    return Promise.resolve({ status: 'skipped' })
  }
}
