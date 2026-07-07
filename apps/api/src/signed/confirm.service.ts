/**
 * @fileoverview Post-direct-upload verification. A presigned PUT sends bytes
 * straight from the client to the provider, so the server-side MIME/size
 * validation and the scanner pipeline NEVER RUN on that object. This service is
 * the honest, mandatory mitigation: it `head()`s the landed object, re-applies
 * the configured size and MIME policy, runs the confirm-time scanner seam, and
 * returns a structured verification report. A key that never landed surfaces the
 * library's `STORAGE_OBJECT_NOT_FOUND` (404) through the global filter.
 * @layer api/signed
 */
import { Inject, Injectable } from '@nestjs/common'
// StorageService must be a value import so NestJS can resolve it from the
// emitted `design:paramtypes` metadata; a type-only import is elided and DI fails.
import { BYMAX_STORAGE_OPTIONS, StorageService } from '@bymax-one/nest-storage'
import type { ObjectMetadata } from '@bymax-one/nest-storage'
import { CONFIRM_SCANNER, type IConfirmScanner, type ScanVerdict } from './confirm-scanner.js'
import type { StoragePolicyOptions } from './storage-policy.js'

/** Structured outcome of a confirm request. */
export interface ConfirmResult {
  /** True only when size, MIME, and scan all pass. */
  confirmed: boolean
  /** The verified key. */
  key: string
  /** Full metadata of the landed object (size, contentType, etag, ...). */
  metadata: ObjectMetadata
  /** The scanner verdict (`skipped` until the real scanner is wired). */
  scan: ScanVerdict
  /**
   * Per-check outcomes so a caller sees exactly which policy gate failed. Absent
   * checks (e.g. no size policy configured) are reported as `true`.
   */
  checks: { sizeWithinPolicy: boolean; mimeAllowed: boolean; scanClean: boolean }
  /** States that local validation did not run on the direct PUT. */
  note: string
}

/** Honest, non-optional note documenting the validation-bypass boundary. */
const BYPASS_NOTE =
  'A presigned PUT bypasses server-side MIME/size validation by design; this confirm re-checks the landed object (size, MIME, scan) as the mitigation. The scanner seam reports "skipped" until a real content scanner is wired (spec §16).'

/**
 * Tests a MIME type against a whitelist supporting exact matches, a bare `*`
 * (any type), and `type/*` prefix wildcards. Mirrors the pipeline's whitelist
 * semantics so confirm re-applies the same policy the direct PUT skipped.
 *
 * @param contentType - The landed object's content type (may be undefined).
 * @param whitelist - Allowed MIME entries (exact or `type/*`).
 * @returns True when the content type is allowed by any entry.
 */
export function isMimeAllowed(
  contentType: string | undefined,
  whitelist: readonly string[],
): boolean {
  if (contentType === undefined || contentType.length === 0) {
    return false
  }
  return whitelist.some((entry) => {
    if (entry === '*' || entry === '*/*') {
      return true
    }
    if (entry.endsWith('/*')) {
      return contentType.startsWith(`${entry.slice(0, -1)}`)
    }
    return entry === contentType
  })
}

/** Verifies objects that landed via a direct presigned PUT. */
@Injectable()
export class ConfirmService {
  constructor(
    private readonly storage: StorageService,
    @Inject(BYMAX_STORAGE_OPTIONS) private readonly options: StoragePolicyOptions,
    @Inject(CONFIRM_SCANNER) private readonly scanner: IConfirmScanner,
  ) {}

  /**
   * Verifies a directly-uploaded object. Reads its metadata with `head()`
   * (propagating `STORAGE_OBJECT_NOT_FOUND` for a key that never landed),
   * re-applies the configured size and MIME policy, and runs the scanner seam.
   *
   * @param key - The raw object key the client PUT to.
   * @returns The structured verification report.
   * @throws {StorageException} `STORAGE_OBJECT_NOT_FOUND` when the key is absent.
   * @throws {StorageException} Propagates any other provider error.
   */
  async confirm(key: string): Promise<ConfirmResult> {
    const metadata = await this.storage.head(key)
    const sizeWithinPolicy = this.isSizeWithinPolicy(metadata.size)
    const mimeAllowed = isMimeAllowed(
      metadata.contentType,
      this.options.validation?.mimeWhitelist ?? [],
    )
    const scan = await this.scanner.scan(key, this.options.bucket)
    const scanClean = scan.status !== 'infected'
    return {
      confirmed: sizeWithinPolicy && mimeAllowed && scanClean,
      key,
      metadata,
      scan,
      checks: { sizeWithinPolicy, mimeAllowed, scanClean },
      note: BYPASS_NOTE,
    }
  }

  /**
   * Returns true when the landed size satisfies the configured `maxSizeBytes`.
   * When no size policy is configured the check passes (nothing to enforce).
   *
   * @param size - The landed object's byte size.
   * @returns True when within policy (or no policy is set).
   */
  private isSizeWithinPolicy(size: number): boolean {
    const max = this.options.validation?.maxSizeBytes
    return max === undefined || size <= max
  }
}
