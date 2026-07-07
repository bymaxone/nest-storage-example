/**
 * @fileoverview Vault object-level endpoints. Thin controller: validates query
 * params with `ZodValidationPipe`, delegates to `VaultService`, and sets HTTP
 * response headers from the library's `ObjectMetadata`. Routes: stream proxy,
 * size-guarded buffer preview, byte-range (base64), versioned retrieval, head
 * metadata, public-URL rendering, and single delete (spec §11.1, §12.1-§12.3).
 * @layer api/vault
 */
import { pipeline } from 'node:stream/promises'
import { Controller, Delete, Get, Query, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Response } from 'express'
import type { ObjectMetadata } from '@bymax-one/nest-storage'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import type { Env } from '../config/env.schema.js'
import { VaultService } from './vault.service.js'
import type {
  BufferedDownloadResult,
  PublicUrlResponse,
  DeleteOneResponse,
} from './vault.service.js'
import {
  downloadQuerySchema,
  rangeQuerySchema,
  versionQuerySchema,
  type DownloadQuery,
  type RangeQuery,
  type VersionQuery,
} from './dto/download.dto.js'

/** Vault download controller: all `/vault/object/*` read routes. */
@Controller('vault/object')
export class VaultController {
  private readonly versionedBucket: string

  constructor(
    private readonly vaultService: VaultService,
    private readonly config: ConfigService<{ env: Env }, true>,
  ) {
    this.versionedBucket = this.config.get('env', { infer: true }).STORAGE_VERSIONED_BUCKET
  }

  /**
   * GET /vault/object/download?key= - stream an object with metadata headers.
   *
   * Streams the library body to the response with `pipeline`, which propagates
   * stream errors (rejecting this handler so the global filter runs) and tears
   * both streams down on client disconnect. Headers are set from `ObjectMetadata`
   * before streaming begins (spec §11.1, §12.1).
   *
   * @param query - Validated query with `key`.
   * @param res - The Express response used for header-setting and streaming.
   * @throws Propagates any error emitted by the source stream.
   */
  @Get('download')
  async download(
    @Query(new ZodValidationPipe(downloadQuerySchema)) query: DownloadQuery,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, metadata } = await this.vaultService.download(query.key)
    res.setHeader('Content-Type', metadata.contentType)
    res.setHeader('Content-Length', metadata.size)
    if (metadata.contentDisposition !== undefined) {
      res.setHeader('Content-Disposition', metadata.contentDisposition)
    }
    if (metadata.cacheControl !== undefined) {
      res.setHeader('Cache-Control', metadata.cacheControl)
    }
    await pipeline(stream, res)
  }

  /**
   * GET /vault/object/preview?key= - buffer and return small objects.
   *
   * Objects larger than 10 MiB are rejected with 413 BEFORE downloading
   * (the size check uses `head()`). Returns base64-encoded content for safe
   * JSON transport (spec §11.1).
   *
   * @param query - Validated query with `key`.
   * @returns `{ base64, metadata }` for the full object.
   */
  @Get('preview')
  async preview(
    @Query(new ZodValidationPipe(downloadQuerySchema)) query: DownloadQuery,
  ): Promise<BufferedDownloadResult> {
    return this.vaultService.preview(query.key)
  }

  /**
   * GET /vault/object/range?key=&start=&end= - fetch a byte range as base64.
   *
   * Builds the `bytes=start-end` range header and returns the base64-encoded
   * slice plus the object metadata. Useful for hex panel previews (spec §11.1).
   *
   * @param query - Validated query with `key`, `start`, and `end`.
   * @returns `{ base64, metadata }` for the requested bytes.
   */
  @Get('range')
  async downloadRange(
    @Query(new ZodValidationPipe(rangeQuerySchema)) query: RangeQuery,
  ): Promise<BufferedDownloadResult> {
    return this.vaultService.downloadRange(query.key, query.start, query.end)
  }

  /**
   * GET /vault/object/version?key=&versionId= - download from the versioned bucket.
   *
   * Targets the `STORAGE_VERSIONED_BUCKET` (defaults to `vault-versioned`).
   * See the VaultService fileoverview for the reconciled drift note: the library's
   * `DownloadOptions` does not expose a `versionId` selector; this endpoint
   * demonstrates the versioned-bucket pattern and echoes the `versionId` accepted
   * in the query for forward compatibility.
   *
   * @param query - Validated query with `key` and `versionId`.
   * @returns `{ base64, metadata, requestedVersionId }`.
   */
  @Get('version')
  async downloadVersion(
    @Query(new ZodValidationPipe(versionQuerySchema)) query: VersionQuery,
  ): Promise<BufferedDownloadResult & { requestedVersionId: string }> {
    const result = await this.vaultService.downloadVersion(query.key, this.versionedBucket)
    return { ...result, requestedVersionId: query.versionId }
  }

  /**
   * GET /vault/object?key= - full object metadata without downloading the body.
   *
   * Returns the complete `ObjectMetadata` from `head()`: size, content type,
   * etag, lastModified, storage class, custom metadata, and versionId when
   * present on a versioned bucket (spec §11.1).
   *
   * @param query - Validated query with `key`.
   * @returns The complete `ObjectMetadata` for the object.
   * @throws Propagates `STORAGE_OBJECT_NOT_FOUND` for a missing key.
   */
  @Get()
  async head(
    @Query(new ZodValidationPipe(downloadQuerySchema)) query: DownloadQuery,
  ): Promise<ObjectMetadata> {
    return this.vaultService.head(query.key)
  }

  /**
   * GET /vault/object/public-url?key= - plain and CDN public URLs.
   *
   * Returns `{ url, cdnUrl?, note }`. `cdnUrl` is present only when
   * `STORAGE_CDN_BASE_URL` is configured. Both URLs are unsigned and
   * existence-unchecked -- the response note documents this boundary
   * (spec §11.1).
   *
   * @param query - Validated query with `key`.
   * @returns `{ url, cdnUrl?, note }`.
   */
  @Get('public-url')
  getPublicUrl(
    @Query(new ZodValidationPipe(downloadQuerySchema)) query: DownloadQuery,
  ): PublicUrlResponse {
    const env = this.config.get('env', { infer: true })
    return this.vaultService.getPublicUrls(
      query.key,
      env.STORAGE_PUBLIC_BASE_URL,
      env.STORAGE_CDN_BASE_URL,
      env.STORAGE_KEY_PREFIX,
    )
  }

  /**
   * DELETE /vault/object?key= - idempotent single object delete.
   *
   * The library treats a missing key as a no-op (logged as a warning). The
   * `warned` flag is derived from a pre-delete `exists()` check so the
   * idempotency behavior is observable to the UI (spec §11.1).
   *
   * @param query - Validated query with `key`.
   * @returns `{ deleted: key, warned: boolean }`.
   */
  @Delete()
  async delete(
    @Query(new ZodValidationPipe(downloadQuerySchema)) query: DownloadQuery,
  ): Promise<DeleteOneResponse> {
    return this.vaultService.deleteOne(query.key)
  }
}
