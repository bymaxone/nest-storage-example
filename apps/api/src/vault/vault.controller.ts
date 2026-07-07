/**
 * @fileoverview Vault download endpoints. Thin controller: validates query
 * params with `ZodValidationPipe`, delegates to `VaultService`, and sets HTTP
 * response headers from the library's `ObjectMetadata`. Routes: stream proxy,
 * size-guarded buffer preview, byte-range (base64), and versioned retrieval
 * from the versioned bucket (spec §11.1, §12.1-§12.3).
 * @layer api/vault
 */
import { Controller, Get, Query, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Response } from 'express'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import type { Env } from '../config/env.schema.js'
import { VaultService } from './vault.service.js'
import type { BufferedDownloadResult } from './vault.service.js'
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
   * Pipes the library stream directly to the response. Headers are set from
   * `ObjectMetadata` before piping begins (spec §11.1, §12.1).
   *
   * @param query - Validated query with `key`.
   * @param res - The Express response used for header-setting and piping.
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
    stream.pipe(res)
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
}
