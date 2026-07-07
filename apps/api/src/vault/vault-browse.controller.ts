/**
 * @fileoverview Vault browse controller. Handles collection-level vault routes:
 * paged listing (`GET /vault`), bulk delete (`POST /vault/bulk-delete`), and
 * server-side copy (`POST /vault/copy`). Object-level routes (head, download,
 * public-url, single delete) live in `VaultController` (`vault/object`).
 * @layer api/vault
 */
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import type { Env } from '../config/env.schema.js'
import { VaultService } from './vault.service.js'
import type { ListResponse, CopyResponse } from './vault.service.js'
import type { DeleteManyResult } from '@bymax-one/nest-storage'
import { listQuerySchema, type ListQuery } from './dto/list-query.dto.js'
import { bulkDeleteBodySchema, type BulkDeleteBody } from './dto/bulk-delete.dto.js'
import { copyBodySchema, type CopyBody } from './dto/copy.dto.js'

/** Vault browse controller: collection-level `/vault` routes. */
@Controller('vault')
export class VaultBrowseController {
  constructor(
    private readonly vaultService: VaultService,
    private readonly config: ConfigService<{ env: Env }, true>,
  ) {}

  /**
   * GET /vault - list objects with optional prefix, pagination, and folders.
   *
   * Maps `cursor` to the library's `continuationToken` and renames
   * `nextContinuationToken` to `nextCursor` in the response so the client
   * interface is self-describing. `delimiter='/'` aggregates sub-prefixes
   * into `commonPrefixes` (spec §11.1, §15).
   *
   * @param query - Validated query (prefix, maxKeys, cursor, delimiter).
   * @returns One page of objects with folder metadata and pagination state.
   */
  @Get()
  async list(
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
  ): Promise<ListResponse> {
    return this.vaultService.list(query)
  }

  /**
   * POST /vault/bulk-delete - delete up to 1000 objects in a single request.
   *
   * Returns the library's `{ deleted, failed }` report verbatim -- partial
   * failures are never masked. The 1-1000 key limit mirrors the S3 API hard
   * cap; clients must batch beyond that themselves (spec §11.1).
   *
   * @param body - Validated body with `keys` (1-1000 non-empty strings).
   * @returns `{ deleted: string[], failed: FailedDeletion[] }` from the library.
   */
  @Post('bulk-delete')
  async bulkDelete(
    @Body(new ZodValidationPipe(bulkDeleteBodySchema)) body: BulkDeleteBody,
  ): Promise<DeleteManyResult> {
    return this.vaultService.deleteMany(body.keys)
  }

  /**
   * POST /vault/copy - server-side copy with optional archive target.
   *
   * No bytes flow through the app -- the library issues a CopyObject request
   * directly at the provider. An `exists()` precheck surfaces a typed 404
   * envelope before attempting the copy. `deleteSource` converts the copy into
   * a rename (spec §11.1).
   *
   * @param body - Validated body (sourceKey, destinationKey, destination, deleteSource).
   * @returns ETag, source/destination keys, and the target bucket name.
   * @throws Propagates `STORAGE_OBJECT_NOT_FOUND` when the source is absent.
   */
  @Post('copy')
  async copy(@Body(new ZodValidationPipe(copyBodySchema)) body: CopyBody): Promise<CopyResponse> {
    const env = this.config.get('env', { infer: true })
    // Build CopyServiceOptions explicitly to satisfy exactOptionalPropertyTypes:
    // CopyBody.deleteSource is boolean | undefined (Zod optional output), while
    // CopyServiceOptions.deleteSource is strictly optional (boolean, not undefined).
    const opts = {
      sourceKey: body.sourceKey,
      destinationKey: body.destinationKey,
      destination: body.destination,
      ...(body.deleteSource !== undefined ? { deleteSource: body.deleteSource } : {}),
    }
    return this.vaultService.copy(opts, env.STORAGE_ARCHIVE_BUCKET, env.STORAGE_BUCKET)
  }
}
