/**
 * @fileoverview Vault service. Owns all library calls for the vault surface:
 * stream proxy, size-guarded buffer preview, byte-range, versioned-bucket
 * retrieval, paged listing, head/exists, public-URL building, idempotent
 * single delete, and bulk delete.
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
// StorageService must be a value import (not `import type`): NestJS resolves the
// constructor dependency from the emitted `design:paramtypes` metadata, which
// requires the class to exist at runtime. A type-only import is elided and DI fails.
import { StorageException, StorageService } from '@bymax-one/nest-storage'
import type {
  ObjectMetadata,
  ListedObject,
  DeleteManyResult,
  CopyOptions,
} from '@bymax-one/nest-storage'
import type { ListQuery } from './dto/list-query.dto.js'

/** Maximum allowed preview size in bytes (10 MiB). */
const MAX_PREVIEW_BYTES = 10 * 1024 * 1024

/** Response shape for the `GET /vault` listing endpoint. */
export interface ListResponse {
  /** One page of objects; fields match `ListedObject` from the library. */
  objects: ListedObject[]
  /** Aggregated sub-prefixes when `delimiter='/'` was passed. */
  commonPrefixes: string[]
  /** `true` when more objects exist beyond this page. */
  isTruncated: boolean
  /** Cursor for the next page (absent on the last page). */
  nextCursor?: string
}

/** Response shape for the `GET /vault/object/public-url` endpoint. */
export interface PublicUrlResponse {
  /** Plain public URL (unsigned, existence-unchecked). */
  url: string
  /** CDN URL, only present when `STORAGE_CDN_BASE_URL` is configured. */
  cdnUrl?: string
  /** Documents that the URL is unsigned and existence is not validated. */
  note: string
}

/** Response shape for the `DELETE /vault/object` endpoint. */
export interface DeleteOneResponse {
  /** The key that was targeted. */
  deleted: string
  /**
   * `true` when the key was absent before the call. The library is idempotent
   * (missing key is a no-op, logged as a warning); this flag surfaces that
   * warning to the caller.
   */
  warned: boolean
}

/** Response shape for `POST /vault/copy`. */
export interface CopyResponse {
  /** ETag of the newly created destination object. */
  etag: string
  /** The source key (as provided). */
  source: string
  /** The destination key (as provided). */
  destination: string
  /** The bucket the destination object was written to. */
  bucket: string
}

/**
 * Maximum allowed size of the base64-encoded range response in bytes (50 MiB).
 * The byte-range endpoint returns bytes as base64 inside JSON, which inflates
 * the payload by ~33% over the raw byte count (base64 encodes 3 raw bytes into
 * 4 characters). The guard bounds the *encoded* size rather than the raw size,
 * so the JSON response heap footprint stays under this cap regardless of the
 * inflation. The corresponding raw-byte ceiling is ~37.5 MiB.
 */
const MAX_RANGE_BASE64_BYTES = 50 * 1024 * 1024

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
   * @throws {PayloadTooLargeException} When the range's base64-encoded size exceeds 50 MiB (a size-limit breach, 413).
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
    const rawBytes = end - start + 1
    // The response encodes the bytes as base64, so guard the estimated encoded
    // size (ceil(rawBytes / 3) * 4) rather than the raw count. This keeps the
    // JSON payload bounded despite the ~33% base64 inflation.
    const base64Bytes = Math.ceil(rawBytes / 3) * 4
    if (base64Bytes > MAX_RANGE_BASE64_BYTES) {
      throw new PayloadTooLargeException({
        error: {
          code: 'RANGE_TOO_LARGE',
          message: `Requested range (${rawBytes} bytes, ~${base64Bytes} bytes base64) exceeds the ${MAX_RANGE_BASE64_BYTES} byte encoded-response limit.`,
          maxBase64Bytes: MAX_RANGE_BASE64_BYTES,
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

  /**
   * Lists one page of objects. Maps the library's `ListOptions` / `ListResult`
   * onto the API response shape: renames `nextContinuationToken` to `nextCursor`
   * so the client interface is self-contained.
   *
   * @param query - Validated listing query (prefix, maxKeys, cursor, delimiter).
   * @returns One page of objects with pagination and folder metadata.
   * @throws {StorageException} Propagates from the library on provider failure.
   */
  async list(query: ListQuery): Promise<ListResponse> {
    const result = await this.storage.list({
      maxKeys: query.maxKeys,
      // Spread optional fields only when defined to satisfy exactOptionalPropertyTypes
      ...(query.prefix !== undefined ? { prefix: query.prefix } : {}),
      ...(query.cursor !== undefined ? { continuationToken: query.cursor } : {}),
      ...(query.delimiter !== undefined ? { delimiter: query.delimiter } : {}),
    })
    return {
      objects: result.objects,
      commonPrefixes: result.commonPrefixes,
      isTruncated: result.isTruncated,
      // Spread optional field only when defined
      ...(result.nextContinuationToken !== undefined
        ? { nextCursor: result.nextContinuationToken }
        : {}),
    }
  }

  /**
   * Returns full object metadata without downloading the body. A missing key
   * propagates as `STORAGE_OBJECT_NOT_FOUND` through the global filter.
   *
   * @param key - The raw object key.
   * @returns The complete `ObjectMetadata` for the object.
   * @throws {StorageException} `STORAGE_OBJECT_NOT_FOUND` when the key is absent.
   */
  async head(key: string): Promise<ObjectMetadata> {
    return this.storage.head(key)
  }

  /**
   * Best-effort existence check. Returns `false` for a missing object and also
   * `false` (with a library-level warning) for any other provider error -- never
   * throws, per the library contract.
   *
   * @param key - The raw object key.
   * @param bucket - Optional per-call bucket override.
   * @returns `true` when the object exists, `false` otherwise.
   */
  async exists(key: string, bucket?: string): Promise<boolean> {
    return this.storage.exists(key, bucket !== undefined ? { bucket } : undefined)
  }

  /**
   * Builds the public URL for an object in plain and, optionally, CDN form.
   * Neither URL is validated against the bucket policy or CDN configuration --
   * public delivery depends on the bucket allowing anonymous reads or a CDN
   * routing the `cdnBaseUrl` host.
   *
   * @param key - The raw object key (before prefix application).
   * @param publicBase - The `STORAGE_PUBLIC_BASE_URL` env value.
   * @param cdnBase - The `STORAGE_CDN_BASE_URL` env value (empty string = absent).
   * @param keyPrefix - The `STORAGE_KEY_PREFIX` env value.
   * @returns `{ url, cdnUrl?, note }`.
   */
  getPublicUrls(
    key: string,
    publicBase: string,
    cdnBase: string,
    keyPrefix: string,
  ): PublicUrlResponse {
    const base = publicBase.replace(/\/$/, '')
    const fullKey = keyPrefix ? `${keyPrefix}/${key}` : key
    const url = `${base}/${fullKey}`
    const cdnUrl = cdnBase ? `${cdnBase.replace(/\/$/, '')}/${fullKey}` : undefined
    return {
      url,
      ...(cdnUrl !== undefined ? { cdnUrl } : {}),
      note: 'URL is unsigned and existence is unchecked; public delivery depends on the bucket policy or CDN.',
    }
  }

  /**
   * Deletes a single object. Idempotent: a missing key is a no-op in the
   * library (logged as a warning). The `warned` flag surfaces that warning
   * to the caller by pre-checking existence before issuing the delete.
   *
   * `warned` is a best-effort signal: the `exists()` check and the `delete()`
   * are not atomic, so under concurrent deletion of the same key the flag may
   * be inaccurate. S3 offers no transactional primitive to close this window;
   * the delete itself remains correct and idempotent regardless.
   *
   * @param key - The raw object key.
   * @returns `{ deleted: key, warned: true }` when the key was absent.
   * @throws {StorageException} Propagates any non-missing-key library error.
   */
  async deleteOne(key: string): Promise<DeleteOneResponse> {
    const isExisting = await this.storage.exists(key)
    await this.storage.delete(key)
    return { deleted: key, warned: !isExisting }
  }

  /**
   * Deletes many objects in one S3 batch request and returns the verbatim
   * `{ deleted, failed }` report from the library. Partial failures are never
   * masked.
   *
   * @param keys - Raw object keys to delete (1-1000).
   * @returns The library's `DeleteManyResult` (deleted keys + per-key failures).
   * @throws {StorageException} Propagates from the library on a whole-batch failure.
   */
  async deleteMany(keys: string[]): Promise<DeleteManyResult> {
    return this.storage.deleteMany(keys)
  }

  /**
   * Server-side copies an object (no bytes flow through the app). Applies an
   * `exists()` precheck so a missing source returns the typed not-found envelope
   * before any S3 CopyObject request is issued.
   *
   * @param options - Source key, destination key/bucket, and deleteSource flag.
   * @param archiveBucket - Bucket name for `destination='archive'` mode.
   * @param defaultBucket - The default vault bucket name for the response.
   * @returns Copy result with ETag, source/destination keys, and the target bucket.
   * @throws {StorageException} `STORAGE_OBJECT_NOT_FOUND` when the source is absent.
   * @throws {StorageException} Propagates other library errors.
   */
  async copy(
    options: CopyServiceOptions,
    archiveBucket: string,
    defaultBucket: string,
  ): Promise<CopyResponse> {
    const isSourcePresent = await this.storage.exists(options.sourceKey)
    if (!isSourcePresent) {
      throw new StorageException('STORAGE_OBJECT_NOT_FOUND', undefined, {
        key: options.sourceKey,
      })
    }
    const isArchive = options.destination === 'archive'
    // Spread destinationBucket only when targeting archive to satisfy exactOptionalPropertyTypes
    const copyOpts: CopyOptions = {
      sourceKey: options.sourceKey,
      destinationKey: options.destinationKey,
      ...(isArchive ? { destinationBucket: archiveBucket } : {}),
    }
    const { etag } = await this.storage.copy(copyOpts)
    if (options.deleteSource === true) {
      await this.storage.delete(options.sourceKey)
    }
    return {
      etag,
      source: options.sourceKey,
      destination: options.destinationKey,
      bucket: isArchive ? archiveBucket : defaultBucket,
    }
  }
}

/** Copy operation parameters, aligned with the `CopyDto` shape. */
export interface CopyServiceOptions {
  sourceKey: string
  destinationKey: string
  /** `'same'` keeps the default bucket; `'archive'` targets `archiveBucket`. */
  destination: 'same' | 'archive'
  /** When `true`, the source object is deleted after a successful copy. */
  deleteSource?: boolean
}
