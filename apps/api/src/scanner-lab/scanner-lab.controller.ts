/**
 * @fileoverview Scanner-lab endpoints. Thin controller: it validates input with
 * `ZodValidationPipe` and delegates to `ScannerLabService`. `POST /scanner/upload`
 * drives the real scanner pipeline (an infected marker yields 422
 * `STORAGE_SCAN_INFECTED`, an unknown marker passes with a warning or yields 422
 * `STORAGE_SCAN_INCONCLUSIVE` per `rejectOnUnknown`); `GET /scanner/exists`
 * probes an object's presence to prove post-upload removal; `GET /scanner/config`
 * renders the active mode and `rejectOnUnknown` from the resolved options
 * (spec §16).
 * @layer api/scanner-lab
 */
import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import {
  ScannerLabService,
  type ScannerConfigView,
  type ScannerExistsResult,
  type ScannerUploadResult,
} from './scanner-lab.service.js'
import { scannerUploadBodySchema, type ScannerUploadBody } from './dto/scanner-upload.dto.js'
import { scannerExistsQuerySchema, type ScannerExistsQuery } from './dto/scanner-exists.dto.js'

/** Scanner pipeline laboratory: all `/scanner/*` routes. */
@Controller('scanner')
export class ScannerLabController {
  constructor(private readonly service: ScannerLabService) {}

  /**
   * POST /scanner/upload - drive text content through the real scanner pipeline.
   *
   * An infected marker is rejected with 422 (the object is also removed in
   * post-upload mode); an unknown marker passes with a warning or is rejected
   * with 422 depending on `rejectOnUnknown`; clean content is stored. Rejections
   * render the library envelope via the global filter.
   *
   * @param body - Validated body: text content and an optional key seed.
   * @returns The library result, the raw key, the verdict, and any warning.
   */
  @Post('upload')
  @HttpCode(201)
  upload(
    @Body(new ZodValidationPipe(scannerUploadBodySchema)) body: ScannerUploadBody,
  ): Promise<ScannerUploadResult> {
    return this.service.upload(body)
  }

  /**
   * GET /scanner/exists - probe whether an object is present.
   *
   * Backs the post-upload removal proof: after the library removes an infected
   * object, this reports `exists: false` for its key.
   *
   * @param query - Validated query carrying the raw object key.
   * @returns The key and its presence flag.
   */
  @Get('exists')
  exists(
    @Query(new ZodValidationPipe(scannerExistsQuerySchema)) query: ScannerExistsQuery,
  ): Promise<ScannerExistsResult> {
    return this.service.exists(query.key)
  }

  /**
   * GET /scanner/config - render the active scanner configuration.
   *
   * @returns The enabled flag, resolved mode, and rejectOnUnknown flag.
   */
  @Get('config')
  config(): ScannerConfigView {
    return this.service.config()
  }
}
