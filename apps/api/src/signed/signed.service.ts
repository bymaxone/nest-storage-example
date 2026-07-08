/**
 * @fileoverview Signed-URL service. Owns every library `SignedUrlService` call
 * for the presigned surface: GET download URLs (response overrides + a visible
 * requested-vs-effective TTL clamp), PUT upload URLs (required headers + an
 * advisory Content-Length-Range policy), and presigned multipart issuance. It
 * also owns the abort path, which the library does not expose, via the raw
 * `BYMAX_STORAGE_S3_CLIENT` token.
 *
 * **Drift note (reconciled):** the library's `MultipartUploadUrlsResult` carries
 * no `expiresAt`, and it exposes no multipart-abort method. This service reads
 * the effective (clamped) expiry from the `X-Amz-Date`/`X-Amz-Expires` the
 * library signed into the returned URL rather than recomputing the clamp, and
 * aborts through the raw client mirroring the library's key-prefix rule.
 *
 * SECURITY: a signed URL is a temporary credential. This service never logs one
 * and never persists one; controllers return it once to the requesting client.
 * @layer api/signed
 */
import { Inject, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { AbortMultipartUploadCommand, type S3Client } from '@aws-sdk/client-s3'
// SignedUrlService/StorageException must be value imports so NestJS resolves the
// constructor dependency from the emitted metadata; a type-only import is elided.
import {
  BYMAX_STORAGE_OPTIONS,
  BYMAX_STORAGE_S3_CLIENT,
  SignedUrlService,
  StorageException,
  STORAGE_ERROR_CODES,
} from '@bymax-one/nest-storage'
import type { StoragePolicyOptions } from './storage-policy.js'
import type { DownloadUrlBody } from './dto/download-url.dto.js'
import type { UploadUrlBody } from './dto/upload-url.dto.js'
import type { MultipartUrlsBody, MultipartAbortBody } from './dto/multipart-urls.dto.js'

/** Milliseconds per second, for TTL/expiry arithmetic. */
const MS_PER_SECOND = 1000

/** S3's hard minimum size for every multipart part except the last (5 MiB). */
const S3_MIN_PART_SIZE_BYTES = 5 * 1024 * 1024

/** The requested-vs-effective TTL view surfaced on every issued URL. */
export interface TtlView {
  /** Absolute expiry, ISO-8601. */
  expiresAt: string
  /** TTL the caller asked for (or the configured default when omitted). */
  requestedTtlSeconds: number
  /** TTL actually in force, read from what the library signed. */
  effectiveTtlSeconds: number
  /** True when the library clamped the request down to the cap. */
  clamped: boolean
  /** The configured hard cap, for context. */
  maxTtlSeconds: number
}

/** Response for `POST /signed/download-url`. */
export interface DownloadUrlResponse extends TtlView {
  url: string
  method: 'GET'
  requiredHeaders: Record<string, string>
}

/** Response for `POST /signed/upload-url`. */
export interface UploadUrlResponse extends TtlView {
  url: string
  method: 'PUT'
  key: string
  requiredHeaders: Record<string, string>
  /**
   * Advisory byte range only. SigV4 cannot pin a maximum size at PUT time, so
   * this is never enforced by the provider; confirm verifies the landed size
   * against the server's CONFIGURED size policy, not against this value.
   */
  contentLengthRange: { minBytes: number; maxBytes?: number }
  note: string
}

/** Response for `POST /signed/multipart-urls`. */
export interface MultipartUrlsResponse {
  uploadId: string
  key: string
  partUrls: { partNumber: number; url: string }[]
  completeUrl: string
  expiresAt: string
  effectiveTtlSeconds: number
  parts: number
  minPartSizeBytes: number
  note: string
}

/** Response for `POST /signed/multipart-abort`. */
export interface MultipartAbortResponse {
  aborted: true
  key: string
  uploadId: string
  note: string
}

/**
 * Reads the effective expiry a SigV4 presigned URL was signed with, from its
 * `X-Amz-Date` (signing time) and `X-Amz-Expires` (lifetime in seconds) query
 * parameters. This surfaces the library's own clamped decision without
 * recomputing the clamp; the URL string itself is never logged.
 *
 * @param signedUrl - A presigned URL produced by the library.
 * @returns The absolute expiry and the effective TTL in seconds.
 * @throws {StorageException} `STORAGE_PROVIDER_ERROR` when the SigV4 params are absent.
 */
export function readSignedUrlExpiry(signedUrl: string): {
  expiresAt: Date
  effectiveTtlSeconds: number
} {
  const params = new URL(signedUrl).searchParams
  const amzDate = params.get('X-Amz-Date')
  const expires = params.get('X-Amz-Expires')
  if (amzDate === null || expires === null) {
    throw new StorageException(STORAGE_ERROR_CODES.STORAGE_PROVIDER_ERROR, undefined, {
      reason: 'presigned URL is missing SigV4 expiry parameters',
    })
  }
  const effectiveTtlSeconds = Number(expires)
  const signedAt = parseAmzDate(amzDate)
  if (!Number.isFinite(signedAt) || !Number.isFinite(effectiveTtlSeconds)) {
    throw new StorageException(STORAGE_ERROR_CODES.STORAGE_PROVIDER_ERROR, undefined, {
      reason: 'presigned URL carries an unparseable SigV4 expiry',
    })
  }
  return {
    expiresAt: new Date(signedAt + effectiveTtlSeconds * MS_PER_SECOND),
    effectiveTtlSeconds,
  }
}

/**
 * Parses an ISO-8601 basic `X-Amz-Date` (`YYYYMMDDTHHMMSSZ`) into epoch ms.
 *
 * @param amzDate - The `X-Amz-Date` value.
 * @returns Epoch milliseconds for the signing instant.
 */
function parseAmzDate(amzDate: string): number {
  // Anchored match: the value must be EXACTLY the basic format end to end, so a
  // string that merely contains a date (leading/trailing characters) fails the match
  // and yields NaN rather than a partially-parsed instant.
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(amzDate)
  if (match === null) {
    return Number.NaN
  }
  const [, year, month, day, hour, minute, second] = match
  return Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`)
}

/** Service issuing presigned URLs and owning the multipart abort path. */
@Injectable()
export class SignedService {
  constructor(
    private readonly signedUrls: SignedUrlService,
    @Inject(BYMAX_STORAGE_OPTIONS) private readonly options: StoragePolicyOptions,
    @Inject(BYMAX_STORAGE_S3_CLIENT) private readonly s3Client: S3Client | null,
  ) {}

  /**
   * Issues a presigned GET URL with optional response-header overrides, and
   * surfaces the requested-vs-effective TTL so the silent clamp is observable.
   * A non-positive TTL propagates `STORAGE_SIGNED_URL_TTL_INVALID` from the
   * library through the global filter.
   *
   * @param body - Validated download-url request.
   * @returns The presigned GET URL and its TTL view.
   * @throws {StorageException} `STORAGE_SIGNED_URL_TTL_INVALID` for a non-positive TTL.
   */
  async createDownloadUrl(body: DownloadUrlBody): Promise<DownloadUrlResponse> {
    const result = await this.signedUrls.getDownloadUrl({
      key: body.key,
      ...(body.ttlSeconds !== undefined ? { ttlSeconds: body.ttlSeconds } : {}),
      ...(body.responseContentDisposition !== undefined
        ? { responseContentDisposition: body.responseContentDisposition }
        : {}),
      ...(body.responseContentType !== undefined
        ? { responseContentType: body.responseContentType }
        : {}),
    })
    const requested = body.ttlSeconds ?? this.options.signedUrls.defaultGetTtlSeconds
    return {
      url: result.url,
      method: 'GET',
      requiredHeaders: result.requiredHeaders,
      ...this.buildTtlView(requested, result.url),
    }
  }

  /**
   * Issues a presigned PUT URL. The client MUST send every `requiredHeaders`
   * entry verbatim (each is part of the signature). The response carries an
   * advisory Content-Length-Range and states that the mandatory `confirm` step
   * re-checks the landed object against the server's CONFIGURED size/MIME policy
   * (not the per-request value), since a direct PUT bypasses local validation by
   * design.
   *
   * @param body - Validated upload-url request.
   * @returns The presigned PUT URL, the composed key, and the TTL view.
   * @throws {StorageException} `STORAGE_SIGNED_URL_TTL_INVALID` for a non-positive TTL.
   */
  async createUploadUrl(body: UploadUrlBody): Promise<UploadUrlResponse> {
    const key = `${body.category}/${randomUUID()}`
    const result = await this.signedUrls.getUploadUrl({
      key,
      contentType: body.contentType,
      ...(body.maxSizeBytes !== undefined ? { maxSizeBytes: body.maxSizeBytes } : {}),
      ...(body.ttlSeconds !== undefined ? { ttlSeconds: body.ttlSeconds } : {}),
    })
    const requested = body.ttlSeconds ?? this.options.signedUrls.defaultPutTtlSeconds
    return {
      url: result.url,
      method: 'PUT',
      key,
      requiredHeaders: result.requiredHeaders,
      contentLengthRange: this.buildContentLengthRange(body.maxSizeBytes),
      note: "This direct PUT bypasses server-side MIME/size validation by design. After the PUT, the client MUST call POST /signed/confirm to verify the landed object (size, MIME, scan). contentLengthRange is advisory only: SigV4 cannot pin a maximum size at PUT time, so the provider may store an over-limit body. The landed size is verified at confirm against the server's CONFIGURED size policy, NOT against this per-request maxSizeBytes.",
      ...this.buildTtlView(requested, result.url),
    }
  }

  /**
   * Presigns a multipart upload: an upload session plus one URL per part and the
   * complete URL. The response documents the S3 5 MiB minimum part size and the
   * consumer's abort responsibility (orphan parts are billed until aborted).
   *
   * @param body - Validated multipart-urls request.
   * @returns The uploadId, part URLs, complete URL, and effective expiry.
   * @throws {StorageException} `STORAGE_SIGNED_URL_TTL_INVALID` for a non-positive TTL.
   */
  async createMultipartUrls(body: MultipartUrlsBody): Promise<MultipartUrlsResponse> {
    const key = `${body.category}/${randomUUID()}`
    const result = await this.signedUrls.getMultipartUploadUrls({
      key,
      contentType: body.contentType,
      parts: body.parts,
      ...(body.ttlSeconds !== undefined ? { ttlSeconds: body.ttlSeconds } : {}),
    })
    const { expiresAt, effectiveTtlSeconds } = readSignedUrlExpiry(result.completeUrl)
    return {
      uploadId: result.uploadId,
      key,
      partUrls: result.partUrls,
      completeUrl: result.completeUrl,
      expiresAt: expiresAt.toISOString(),
      effectiveTtlSeconds,
      parts: body.parts,
      minPartSizeBytes: S3_MIN_PART_SIZE_BYTES,
      note: 'Every part except the last must be at least 5 MiB (S3 rule). The consumer orchestrates the parts and MUST call POST /signed/multipart-abort if the upload is not completed, or the uploaded parts are billed as orphans.',
    }
  }

  /**
   * Aborts an in-progress multipart upload through the raw S3 client (the
   * library exposes no abort). Mirrors the library's key-prefix rule so the
   * abort targets the identical key the multipart issuance signed.
   *
   * @param body - Validated abort request (raw key + uploadId).
   * @returns Confirmation that the abort was issued.
   * @throws {StorageException} `STORAGE_NOT_CONFIGURED` when no client is configured.
   * @throws {StorageException} `STORAGE_PROVIDER_ERROR` when the provider abort fails.
   */
  async abortMultipart(body: MultipartAbortBody): Promise<MultipartAbortResponse> {
    if (this.s3Client === null) {
      throw new StorageException(STORAGE_ERROR_CODES.STORAGE_NOT_CONFIGURED)
    }
    const finalKey = this.composeKey(body.key)
    try {
      await this.s3Client.send(
        new AbortMultipartUploadCommand({
          Bucket: this.options.bucket,
          Key: finalKey,
          UploadId: body.uploadId,
        }),
      )
    } catch (error) {
      if (error instanceof StorageException) {
        throw error
      }
      throw new StorageException(STORAGE_ERROR_CODES.STORAGE_PROVIDER_ERROR, undefined, {
        op: 'abortMultipartUpload',
        key: body.key,
      })
    }
    return {
      aborted: true,
      key: body.key,
      uploadId: body.uploadId,
      note: 'AbortMultipartUpload is idempotent per S3 semantics; no orphan parts remain for this uploadId.',
    }
  }

  /**
   * Builds the requested-vs-effective TTL view by reading the effective TTL the
   * library signed into the URL (`X-Amz-Expires`), the same authoritative source
   * the multipart path uses. This never recomputes the clamp in app code and is
   * immune to wall-clock skew between signing and this call.
   *
   * @param requestedTtlSeconds - The TTL the caller asked for (or the default).
   * @param signedUrl - The presigned URL the library returned.
   * @returns The TTL view fields.
   */
  private buildTtlView(requestedTtlSeconds: number, signedUrl: string): TtlView {
    const { expiresAt, effectiveTtlSeconds } = readSignedUrlExpiry(signedUrl)
    return {
      expiresAt: expiresAt.toISOString(),
      requestedTtlSeconds,
      effectiveTtlSeconds,
      clamped: effectiveTtlSeconds < requestedTtlSeconds,
      maxTtlSeconds: this.options.signedUrls.maxTtlSeconds,
    }
  }

  /**
   * Computes the advisory upload byte range: the lower of the caller's requested
   * cap and the configured policy cap. Omits `maxBytes` only when neither is set.
   *
   * @param requestedMaxSizeBytes - The caller's requested maximum, if any.
   * @returns The `{ minBytes, maxBytes? }` advisory range.
   */
  private buildContentLengthRange(requestedMaxSizeBytes: number | undefined): {
    minBytes: number
    maxBytes?: number
  } {
    const caps = [requestedMaxSizeBytes, this.options.validation?.maxSizeBytes].filter(
      (value): value is number => value !== undefined,
    )
    return caps.length > 0 ? { minBytes: 0, maxBytes: Math.min(...caps) } : { minBytes: 0 }
  }

  /**
   * Prepends the global key prefix to a raw key, mirroring the library's key
   * resolver so the raw-client abort targets the key the library signed. Rejects
   * the same traversal shapes the library rejects.
   *
   * @param rawKey - The caller-provided raw key.
   * @returns The prefixed, provider-facing key.
   * @throws {StorageException} `STORAGE_KEY_INVALID` for a leading slash or `..` segment.
   */
  private composeKey(rawKey: string): string {
    if (rawKey.startsWith('/') || rawKey.split('/').includes('..')) {
      throw new StorageException(STORAGE_ERROR_CODES.STORAGE_KEY_INVALID, undefined, {
        reason: 'key must not start with "/" or contain ".." segments',
      })
    }
    const collapsed = rawKey.replace(/\/{2,}/g, '/')
    const prefix = this.options.keyPrefix.replace(/^\/+|\/+$/g, '')
    return prefix.length > 0 ? `${prefix}/${collapsed}` : collapsed
  }
}
