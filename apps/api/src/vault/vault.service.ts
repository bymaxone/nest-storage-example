/**
 * @fileoverview Vault service. Owns all library read calls for the vault
 * download surface: stream proxy (piped, never buffered), size-guarded buffer
 * preview, byte-range, and versioned-bucket retrieval.
 *
 * **Drift note (reconciled):** The shipped `DownloadOptions` d.ts does not
 * expose a `versionId` field. The versioned-download endpoint targets the
 * versioned bucket via the `bucket` option and documents the per-version
 * metadata returned by `head()`. A `versionId` query parameter is accepted
 * for forward compatibility but is not forwarded to the library call.
 *
 * The library's `StorageException` propagates through the global filter.
 * @layer api/vault
 */
import { Injectable, BadRequestException, PayloadTooLargeException } from '@nestjs/common'
import type { StorageService, ObjectMetadata } from '@bymax-one/nest-storage'

/** Maximum allowed preview size in bytes (10 MiB). */
const MAX_PREVIEW_BYTES = 10 * 1024 * 1024

/** Maximum allowed byte-range size in bytes (50 MiB) to prevent heap exhaustion. */
const MAX_RANGE_BYTES = 50 * 1024 * 1024

/** Response shape for range and version download endpoints. */
export interface BufferedDownloadResult {
  /** Base64-encoded bytes. */
  base64: string
  /** Object metadata (key, size, content type, etag, etc.). */
  metadata: ObjectMetadata
}

/** Service for vault download operations. */
@Injectable()
export class VaultService {
  constructor(private readonly storage: StorageService) {}

  /**
   * Streams an object, returning the stream and its metadata. The controller
   * pipes the stream directly to the response; no buffering occurs here.
   * Missing objects propagate as `STORAGE_OBJECT_NOT_FOUND`.
   *
   * @param key - The raw object key.
   * @returns The readable stream and its metadata.
   * @throws {StorageException} Propagates from the library when the provider returns an error.
   */
  async download(
    key: string,
  ): Promise<{ stream: NodeJS.ReadableStream; metadata: ObjectMetadata }> {
    return this.storage.download({ key })
  }

  /**
   * Materializes an object into memory after a size guard. Objects larger than
   * 10 MiB are refused with 413 BEFORE downloading -- the guard uses a `head()`
   * call so no bytes are transferred unnecessarily. The returned metadata comes
   * from the `downloadBuffer()` result (not the earlier `head()`), so it reflects
   * the bytes actually returned even if the object changed between the two calls.
   *
   * @param key - The raw object key.
   * @returns The base64-encoded body and the metadata from the download result.
   * @throws PayloadTooLargeException when the object exceeds 10 MiB.
   */
  async preview(key: string): Promise<BufferedDownloadResult> {
    const headMetadata = await this.storage.head(key)
    if (headMetadata.size > MAX_PREVIEW_BYTES) {
      throw new PayloadTooLargeException({
        error: {
          code: 'PREVIEW_SIZE_EXCEEDED',
          message: `Object size ${headMetadata.size} exceeds the 10 MiB preview limit.`,
          limit: MAX_PREVIEW_BYTES,
          actual: headMetadata.size,
        },
      })
    }
    const { buffer, metadata } = await this.storage.downloadBuffer({ key })
    return { base64: buffer.toString('base64'), metadata }
  }

  /**
   * Downloads a byte range and returns the bytes as base64. Validates that
   * `start <= end` before issuing the request.
   *
   * @param key - The raw object key.
   * @param start - First byte offset (inclusive, zero-based).
   * @param end - Last byte offset (inclusive).
   * @returns Base64-encoded range bytes and object metadata.
   * @throws {BadRequestException} When `start > end` (an inverted range is an invalid request shape, 400).
   * @throws {PayloadTooLargeException} When the requested range exceeds 50 MiB (a size-limit breach, 413).
   * @throws {StorageException} Propagates from the library when the provider returns an error.
   */
  async downloadRange(key: string, start: number, end: number): Promise<BufferedDownloadResult> {
    if (start > end) {
      throw new BadRequestException({
        error: {
          code: 'RANGE_INVALID',
          message: `start (${start}) must be <= end (${end}).`,
        },
      })
    }
    if (end - start + 1 > MAX_RANGE_BYTES) {
      throw new PayloadTooLargeException({
        error: {
          code: 'RANGE_TOO_LARGE',
          message: `Requested range ${end - start + 1} bytes exceeds the ${MAX_RANGE_BYTES} byte limit.`,
          maxBytes: MAX_RANGE_BYTES,
        },
      })
    }
    const range = `bytes=${start}-${end}`
    const { buffer, metadata } = await this.storage.downloadBuffer({ key, range })
    return { base64: buffer.toString('base64'), metadata }
  }

  /**
   * Downloads an object from the versioned bucket, returning its current
   * content and the versionId recorded in the object metadata. The library's
   * `DownloadOptions` does not expose a versionId selector -- see the fileoverview
   * drift note. The `versionId` query parameter is accepted and echoed back so
   * callers can verify the expected version against the metadata.
   *
   * @param key - The raw object key.
   * @param versionedBucket - The versioning-enabled bucket name.
   * @returns Base64-encoded object body and metadata (includes `versionId` when set).
   * @throws {StorageException} Propagates from the library when the provider returns an error.
   */
  async downloadVersion(key: string, versionedBucket: string): Promise<BufferedDownloadResult> {
    const { buffer, metadata } = await this.storage.downloadBuffer({
      key,
      bucket: versionedBucket,
    })
    return { base64: buffer.toString('base64'), metadata }
  }
}
