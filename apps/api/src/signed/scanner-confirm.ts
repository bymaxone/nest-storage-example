/**
 * @fileoverview Scanner-backed confirm-time scanner. A direct presigned PUT
 * bypasses the server-side validation and scanner pipeline, so the landed object
 * is unverified. This `IConfirmScanner` closes that gap for real: it downloads a
 * BOUNDED prefix of the object (a `Range` request, never the whole body), runs
 * the same inert `MarkerFileScanner` the pipeline uses, and maps the verdict.
 * On an infected verdict it DELETES the object before returning the refusal, so
 * a threat that arrived through a signed PUT does not survive confirm
 * (spec §12.5, §17).
 * @layer api/signed
 */
import { Injectable } from '@nestjs/common'
// StorageService must be a value import so NestJS can resolve it from the
// emitted `design:paramtypes` metadata; a type-only import is elided and DI fails.
import { StorageService } from '@bymax-one/nest-storage'
// The MarkerFileScanner is the app's shared IFileScanner plugin (also wired into
// the module options in config/storage.config.ts); reusing it keeps the confirm
// verdict identical to what the pre-upload pipeline would have produced.
import { MarkerFileScanner } from '../scanner-lab/marker-file.scanner.js'
import type { IConfirmScanner, ScanVerdict } from './confirm-scanner.js'

/**
 * Bytes of the object read for the confirm scan. Bounds the network read and the
 * buffered memory so a large direct upload never has to be materialized to be
 * scanned for a marker.
 */
const SCAN_PREFIX_BYTES = 4096

/** Confirm-time scanner that really inspects the landed object and removes threats. */
@Injectable()
export class ScannerConfirm implements IConfirmScanner {
  constructor(
    private readonly storage: StorageService,
    private readonly scanner: MarkerFileScanner,
  ) {}

  /**
   * Scans a landed object by streaming a bounded prefix through the marker
   * scanner. A clean or unknown verdict is returned as-is; an infected verdict
   * triggers a real delete of the object before the refusal is returned, so the
   * threat cannot linger after a failed confirm.
   *
   * @param key - The normalized object key to scan.
   * @param bucket - The bucket the object resides in.
   * @returns The confirm verdict (`clean`, `unknown`, or `infected` after removal).
   * @throws {StorageException} Propagates a provider error from the bounded download.
   */
  async scan(key: string, bucket: string): Promise<ScanVerdict> {
    const { stream, metadata } = await this.storage.download({
      key,
      bucket,
      range: `bytes=0-${String(SCAN_PREFIX_BYTES - 1)}`,
    })
    const result = await this.scanner.scan({
      mode: 'pre-upload',
      body: stream,
      key,
      bucket,
      contentType: metadata.contentType,
    })
    if (result.status === 'infected') {
      await this.storage.delete(key, { bucket })
      return {
        status: 'infected',
        ...(result.threat !== undefined ? { threat: result.threat } : {}),
      }
    }
    return { status: result.status }
  }
}
