/**
 * @fileoverview Local view of the resolved storage options the signed surface
 * reads from the `BYMAX_STORAGE_OPTIONS` token. The library resolves and binds
 * its full `ResolvedBymaxStorageOptions` to that token but does not export the
 * type, so this narrows it to exactly the fields the signed services consume:
 * the signed-URL TTL policy (defaults + cap) and the size/MIME validation policy
 * that `POST /signed/confirm` re-applies to a directly-uploaded object.
 * @layer api/signed
 */

/** The signed-URL TTL policy resolved by the library (all fields present). */
export interface SignedUrlPolicy {
  /** Default GET TTL applied when the caller omits `ttlSeconds`. */
  defaultGetTtlSeconds: number
  /** Default PUT TTL applied when the caller omits `ttlSeconds`. */
  defaultPutTtlSeconds: number
  /** Hard cap; the library silently clamps any larger requested TTL to this. */
  maxTtlSeconds: number
}

/** The size/MIME validation policy the confirm step re-checks against. */
export interface ValidationPolicy {
  /** Maximum object size the pipeline accepts; a direct PUT can exceed it. */
  maxSizeBytes?: number
  /** Allowed MIME types (exact or `type/*` wildcard entries). */
  mimeWhitelist?: readonly string[]
}

/** The subset of the resolved storage options the signed surface depends on. */
export interface StoragePolicyOptions {
  /** Default bucket the signed URLs and confirm target. */
  bucket: string
  /**
   * Global key prefix the library prepends to every key. The raw-client abort
   * path mirrors this prefix so it targets the identical key the library signed.
   */
  keyPrefix: string
  /** Signed-URL TTL policy. */
  signedUrls: SignedUrlPolicy
  /** Optional validation policy (present in this app's configuration). */
  validation?: ValidationPolicy
}
