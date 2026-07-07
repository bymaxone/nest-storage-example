/**
 * @fileoverview Presigned-URL endpoints. Thin controller: validates input with
 * `ZodValidationPipe`, delegates to `SignedService` (issuance + abort) and
 * `ConfirmService` (post-direct-upload verification), and returns typed results.
 * Every route is an action (it issues a credential or verifies an object, it
 * does not create a REST resource), so each returns HTTP 200. Issued URLs are
 * credentials and are never logged (spec §12.4, §12.5, §17).
 * @layer api/signed
 */
import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { SignedService } from './signed.service.js'
import type {
  DownloadUrlResponse,
  UploadUrlResponse,
  MultipartUrlsResponse,
  MultipartAbortResponse,
} from './signed.service.js'
import { ConfirmService, type ConfirmResult } from './confirm.service.js'
import { downloadUrlBodySchema, type DownloadUrlBody } from './dto/download-url.dto.js'
import { uploadUrlBodySchema, type UploadUrlBody } from './dto/upload-url.dto.js'
import { confirmBodySchema, type ConfirmBody } from './dto/confirm.dto.js'
import {
  multipartUrlsBodySchema,
  multipartAbortBodySchema,
  type MultipartUrlsBody,
  type MultipartAbortBody,
} from './dto/multipart-urls.dto.js'

/** Presigned surface: all `/signed/*` routes. */
@Controller('signed')
export class SignedController {
  constructor(
    private readonly signed: SignedService,
    private readonly confirm: ConfirmService,
  ) {}

  /**
   * POST /signed/download-url - issue a presigned GET URL.
   *
   * Surfaces the requested-vs-effective TTL so the library's silent clamp is
   * observable, and passes through the response content-type/disposition
   * overrides. A non-positive TTL returns `STORAGE_SIGNED_URL_TTL_INVALID`.
   *
   * @param body - Validated download-url request.
   * @returns The presigned GET URL and its TTL view.
   */
  @Post('download-url')
  @HttpCode(200)
  createDownloadUrl(
    @Body(new ZodValidationPipe(downloadUrlBodySchema)) body: DownloadUrlBody,
  ): Promise<DownloadUrlResponse> {
    return this.signed.createDownloadUrl(body)
  }

  /**
   * POST /signed/upload-url - issue a presigned PUT URL for a direct upload.
   *
   * The response echoes the `requiredHeaders` the client must send and states
   * that the mandatory confirm step enforces size/MIME, since the direct PUT
   * bypasses local validation by design.
   *
   * @param body - Validated upload-url request.
   * @returns The presigned PUT URL, composed key, and TTL view.
   */
  @Post('upload-url')
  @HttpCode(200)
  createUploadUrl(
    @Body(new ZodValidationPipe(uploadUrlBodySchema)) body: UploadUrlBody,
  ): Promise<UploadUrlResponse> {
    return this.signed.createUploadUrl(body)
  }

  /**
   * POST /signed/confirm - verify an object uploaded via a direct presigned PUT.
   *
   * `head()`s the landed object and re-applies the size/MIME policy plus the
   * scanner seam. A key that never landed returns the 404 not-found envelope.
   *
   * @param body - Validated confirm request (object key).
   * @returns The structured verification report.
   */
  @Post('confirm')
  @HttpCode(200)
  confirmUpload(
    @Body(new ZodValidationPipe(confirmBodySchema)) body: ConfirmBody,
  ): Promise<ConfirmResult> {
    return this.confirm.confirm(body.key)
  }

  /**
   * POST /signed/multipart-urls - presign a multipart upload.
   *
   * Returns the uploadId, one URL per part, and the complete URL, plus the
   * effective expiry and the S3 5 MiB minimum-part-size note.
   *
   * @param body - Validated multipart-urls request.
   * @returns The multipart issuance response.
   */
  @Post('multipart-urls')
  @HttpCode(200)
  createMultipartUrls(
    @Body(new ZodValidationPipe(multipartUrlsBodySchema)) body: MultipartUrlsBody,
  ): Promise<MultipartUrlsResponse> {
    return this.signed.createMultipartUrls(body)
  }

  /**
   * POST /signed/multipart-abort - abort an in-progress multipart upload.
   *
   * Issues `AbortMultipartUpload` through the raw client so orphan parts are not
   * billed; the abort responsibility lives with the consumer on the raw
   * presigned path.
   *
   * @param body - Validated abort request (raw key + uploadId).
   * @returns Confirmation the abort was issued.
   */
  @Post('multipart-abort')
  @HttpCode(200)
  abortMultipart(
    @Body(new ZodValidationPipe(multipartAbortBodySchema)) body: MultipartAbortBody,
  ): Promise<MultipartAbortResponse> {
    return this.signed.abortMultipart(body)
  }
}
