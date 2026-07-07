/**
 * @fileoverview Scanner-lab service. Drives the library scanner pipeline through
 * `StorageService.upload` under `scanner-lab/` keys so every verdict is produced
 * by the real pipeline in the resolved mode: an infected marker throws
 * `STORAGE_SCAN_INFECTED` (422) and, in post-upload mode, the library deletes the
 * just-stored object before re-throwing; an unknown marker passes with a warning
 * or throws `STORAGE_SCAN_INCONCLUSIVE` (422) depending on `rejectOnUnknown`.
 *
 * The library's `MarkerFileScanner` inspects the BODY in pre-upload mode but the
 * KEY in post-upload mode, so the lab reflects any marker the scanner detects in
 * the submitted content into the object key too. The verdict is produced by the
 * SAME inert scanner class the library uses (the single source of marker truth);
 * it drives the reflected key and narrates the success response, while the
 * library pipeline remains the enforcement authority (spec §16).
 * @layer api/scanner-lab
 */
import { Inject, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
// StorageService must be a value import (not `import type`): NestJS resolves the
// constructor dependency from the emitted `design:paramtypes` metadata, which
// requires the class to exist at runtime. A type-only import is elided and DI fails.
import { BYMAX_STORAGE_OPTIONS, StorageService } from '@bymax-one/nest-storage'
import type { FileScanResult, UploadResult } from '@bymax-one/nest-storage'
import { INFECTED_MARKER, MarkerFileScanner, UNKNOWN_MARKER } from './marker-file.scanner.js'
import type { ScannerLabPolicyOptions } from './scanner-policy.js'
import type { ScannerUploadBody } from './dto/scanner-upload.dto.js'

/** The active scanner configuration, rendered from the resolved options token. */
export interface ScannerConfigView {
  /** True when a scanner implementation and options are configured. */
  enabled: boolean
  /** The resolved mode, or `null` when scanning is disabled. */
  mode: 'pre-upload' | 'post-upload' | null
  /** Whether an `unknown` verdict is rejected (422) or passed with a warning. */
  rejectOnUnknown: boolean
}

/** Outcome of a scanner-lab upload that the library accepted. */
export interface ScannerUploadResult {
  /** The library upload result for a body the scanner did not reject. */
  result: UploadResult
  /** The raw (pre-prefix) object key, usable with the existence probe. */
  key: string
  /** The verdict the inert scanner produced for the submitted content. */
  verdict: FileScanResult
  /** Present only when an `unknown` verdict was accepted (rejectOnUnknown off). */
  warning?: string
}

/** Existence-probe result backing the post-upload removal proof. */
export interface ScannerExistsResult {
  /** The probed raw key. */
  key: string
  /** True when the object is present, false when absent (e.g. removed after infection). */
  exists: boolean
}

/** Warning surfaced when the pipeline accepts an inconclusive (unknown) verdict. */
const UNKNOWN_ACCEPTED_WARNING =
  'The scanner returned an inconclusive (unknown) verdict; it was accepted because rejectOnUnknown is off. Set SCANNER_REJECT_ON_UNKNOWN=true to reject unknown verdicts with 422 STORAGE_SCAN_INCONCLUSIVE.'

/**
 * Reflects a detected marker into a key label so the post-upload scanner (which
 * inspects the KEY) sees the same marker the pre-upload scanner reads from the
 * body. A clean verdict adds no label.
 *
 * @param status - The verdict status the scanner produced for the content.
 * @returns The key label prefix (marker plus separator) or an empty string.
 */
function markerLabel(status: FileScanResult['status']): string {
  if (status === 'infected') {
    return `${INFECTED_MARKER}--`
  }
  if (status === 'unknown') {
    return `${UNKNOWN_MARKER}--`
  }
  return ''
}

/** Drives the library scanner pipeline and reports the active configuration. */
@Injectable()
export class ScannerLabService {
  constructor(
    private readonly storage: StorageService,
    private readonly scanner: MarkerFileScanner,
    @Inject(BYMAX_STORAGE_OPTIONS) private readonly options: ScannerLabPolicyOptions,
  ) {}

  /**
   * Uploads text content through the real scanner pipeline. The inert scanner
   * classifies the content, that verdict is reflected into the object key so
   * both scan modes observe the marker, and the library enforces the verdict:
   * an infected body throws (deleting the object first in post-upload mode) and
   * an unknown body throws only when `rejectOnUnknown` is set. A verdict the
   * library accepts returns the result plus a warning for an accepted unknown.
   *
   * @param body - The validated request body (text content, optional key seed).
   * @returns The library result, the raw key, the verdict, and any warning.
   * @throws {StorageException} `STORAGE_SCAN_INFECTED` / `STORAGE_SCAN_INCONCLUSIVE` via the library.
   */
  async upload(body: ScannerUploadBody): Promise<ScannerUploadResult> {
    const buffer = Buffer.from(body.content, 'utf8')
    const verdict = await this.scanner.scan({
      mode: 'pre-upload',
      body: buffer,
      key: 'scanner-lab/diagnostic-probe',
      // The marker verdict depends only on the body; the bucket is a required
      // field of the scan input that the marker scanner does not consult.
      bucket: 'scanner-lab',
      contentType: 'text/plain',
    })
    const key = `scanner-lab/${markerLabel(verdict.status)}${body.keySeed ?? randomUUID()}`
    const result = await this.storage.upload({
      key,
      body: buffer,
      contentType: 'text/plain',
      size: buffer.byteLength,
    })
    // Reached only when the library accepted the upload (clean, or unknown with
    // rejectOnUnknown off); infected/rejected verdicts throw above.
    return {
      result,
      key,
      verdict,
      ...(verdict.status === 'unknown' ? { warning: UNKNOWN_ACCEPTED_WARNING } : {}),
    }
  }

  /**
   * Probes whether an object exists, backing the post-upload removal proof: after
   * the library deletes an infected object it reports `false`.
   *
   * @param key - The raw object key to probe.
   * @returns The key and its presence flag.
   */
  async exists(key: string): Promise<ScannerExistsResult> {
    return { key, exists: await this.storage.exists(key) }
  }

  /**
   * Renders the active scanner configuration from the resolved options token so
   * the response reflects exactly what the pipeline runs with. The mode defaults
   * to pre-upload when a scanner is configured without an explicit mode.
   *
   * @returns The enabled flag, resolved mode, and rejectOnUnknown flag.
   */
  config(): ScannerConfigView {
    const scanner = this.options.scanner
    if (scanner === undefined) {
      return { enabled: false, mode: null, rejectOnUnknown: false }
    }
    return {
      enabled: true,
      mode: scanner.mode ?? 'pre-upload',
      rejectOnUnknown: scanner.rejectOnUnknown ?? false,
    }
  }
}
