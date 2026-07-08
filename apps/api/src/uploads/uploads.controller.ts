/**
 * @fileoverview Upload endpoints. Thin controller: validates input with
 * `ZodValidationPipe`, delegates to `UploadsService`, returns typed results.
 * Routes cover every upload strategy the library supports: single-shot,
 * multer-buffered multipart with progress sessions, streaming with known and
 * unknown size, idempotent deduplication, and per-call SSE override including
 * the `'NONE'` sentinel (spec §11.1, §12.1-§12.3).
 * @layer api/uploads
 */
import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Req,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import type { UploadResult } from '@bymax-one/nest-storage'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { UploadsService } from './uploads.service.js'
import { UploadSessionStore } from './upload-session.store.js'
import type { ProgressSnapshot } from './upload-session.store.js'
import {
  singleUploadBodySchema,
  sseOverrideBodySchema,
  type SingleUploadBody,
  type SseOverrideBody,
} from './dto/single-upload.dto.js'
import { multipartUploadBodySchema, type MultipartUploadBody } from './dto/multipart-upload.dto.js'
import { streamUploadQuerySchema, type StreamUploadQuery } from './dto/stream-upload.dto.js'
import {
  idempotentUploadBodySchema,
  type IdempotentUploadBody,
} from './dto/idempotent-upload.dto.js'
import type { MulterFile } from './uploads.service.js'

/**
 * Normalizes a possibly-multivalued request header to a single string. Node's
 * `IncomingHttpHeaders` typings allow `string | string[] | undefined`; when a
 * repeated header arrives as an array, the first value is used.
 *
 * @param value - The raw header value.
 * @returns The first header value, or `undefined` when the header is absent.
 */
function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** Upload controller: all `/uploads/*` routes. */
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly sessions: UploadSessionStore,
  ) {}

  /**
   * POST /uploads/single - single-shot upload with optional header overrides.
   *
   * Multer memory storage buffers the file; the service composes the key and
   * calls the library. The `UploadResult` is returned verbatim so callers can
   * inspect `multipart: false` for small files and `multipart: true` for large
   * files that crossed the configured threshold (spec §12.2).
   *
   * @param file - The uploaded file from multer.
   * @param body - Validated body: category, optional headers and metadata.
   * @returns The library `UploadResult`.
   */
  @Post('single')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(201)
  async uploadSingle(
    @UploadedFile() file: MulterFile,
    @Body(new ZodValidationPipe(singleUploadBodySchema)) body: SingleUploadBody,
  ): Promise<UploadResult> {
    if (file === undefined || file === null) {
      throw new BadRequestException({ error: { code: 'VALIDATION', message: 'file is required' } })
    }
    return this.uploadsService.uploadSingle(file, body)
  }

  /**
   * POST /uploads/multipart - upload with progress session recording.
   *
   * Multer buffers the file (same as single); the service creates an in-memory
   * session and records `onProgress` snapshots so the caller can poll
   * `GET /uploads/sessions/:id` to observe the upload strategy and byte counts
   * (spec §10.3, §12.2).
   *
   * @param file - The uploaded file from multer.
   * @param body - Validated body with category.
   * @returns `{ sessionId, result }` where `result` is the `UploadResult`.
   */
  @Post('multipart')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(201)
  async uploadMultipart(
    @UploadedFile() file: MulterFile,
    @Body(new ZodValidationPipe(multipartUploadBodySchema)) body: MultipartUploadBody,
  ): Promise<{ sessionId: string; result: UploadResult }> {
    if (file === undefined || file === null) {
      throw new BadRequestException({ error: { code: 'VALIDATION', message: 'file is required' } })
    }
    return this.uploadsService.uploadMultipart(file, body)
  }

  /**
   * GET /uploads/sessions/:id - retrieve progress snapshots for an upload.
   *
   * Returns the snapshot list for the given session, or 404 when the session
   * is unknown (evicted from the LRU store or never created).
   *
   * @param id - The session UUID from the upload response.
   * @returns The snapshot array.
   */
  @Get('sessions/:id')
  getSession(@Param('id') id: string): { id: string; snapshots: ProgressSnapshot[] } {
    // UUID v4 format guard: session IDs are always randomUUID() output; anything
    // else is invalid and must not be echoed back to prevent information leakage.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!UUID_RE.test(id)) {
      throw new NotFoundException({ error: { code: 'SESSION_NOT_FOUND' } })
    }
    const snapshots = this.sessions.get(id)
    if (snapshots === null) {
      throw new NotFoundException({ error: { code: 'SESSION_NOT_FOUND' } })
    }
    return { id, snapshots }
  }

  /**
   * POST /uploads/stream - stream the raw request body to the library.
   *
   * When `?knownSize=false` the `Content-Length` is withheld from the library,
   * forcing the multipart path regardless of file size (spec §12.2).
   *
   * @param req - The raw Express request (stream + headers).
   * @param query - Validated query: category, knownSize, optional filename.
   * @returns `{ sessionId, result }` where `result` is the `UploadResult`.
   */
  @Post('stream')
  @HttpCode(201)
  async uploadStream(
    @Req() req: Request,
    @Query(new ZodValidationPipe(streamUploadQuerySchema)) query: StreamUploadQuery,
  ): Promise<{ sessionId: string; result: UploadResult }> {
    // Headers may arrive as string[] (repeated headers) per Node typings; take
    // the first value before use.
    const contentType = firstHeaderValue(req.headers['content-type']) ?? 'application/octet-stream'
    const lengthHeader = firstHeaderValue(req.headers['content-length'])
    // Only forward a Content-Length that is a finite, non-negative integer as the
    // size hint; a negative, fractional, or NaN value is treated as unknown size.
    // Number(undefined) is NaN, so an absent header coerces to NaN directly; the
    // integer/sign guard below then treats NaN (and any negative/fractional value)
    // as unknown size.
    const parsedLength = Number(lengthHeader)
    const size = Number.isInteger(parsedLength) && parsedLength >= 0 ? parsedLength : undefined
    return this.uploadsService.uploadStream(req, contentType, query, size)
  }

  /**
   * POST /uploads/idempotent - deduplicated upload via idempotency key.
   *
   * The library deduplicates by `idempotencyKey` in an in-memory LRU (1000
   * entries, 24 h TTL). A repeat call returns `fromIdempotencyCache: true`
   * without a provider write. The per-instance boundary is stated in the
   * response note (spec §12.3).
   *
   * @param body - Validated body: idempotencyKey, content, contentType.
   * @returns `{ result, note }` where `result` includes `fromIdempotencyCache`.
   */
  @Post('idempotent')
  @HttpCode(201)
  async uploadIdempotent(
    @Body(new ZodValidationPipe(idempotentUploadBodySchema)) body: IdempotentUploadBody,
  ): Promise<{ result: UploadResult; note: string }> {
    return this.uploadsService.uploadIdempotent(body)
  }

  /**
   * POST /uploads/sse-override - upload with per-call SSE algorithm override.
   *
   * Demonstrates `serverSideEncryption` per call, including the `'NONE'`
   * sentinel that forces no encryption even when a global default is configured
   * (spec §12.1).
   *
   * @param file - The uploaded file from multer.
   * @param body - Validated body including `serverSideEncryption`.
   * @returns The library `UploadResult`.
   */
  @Post('sse-override')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(201)
  async uploadWithSseOverride(
    @UploadedFile() file: MulterFile,
    @Body(new ZodValidationPipe(sseOverrideBodySchema)) body: SseOverrideBody,
  ): Promise<UploadResult> {
    if (file === undefined || file === null) {
      throw new BadRequestException({ error: { code: 'VALIDATION', message: 'file is required' } })
    }
    return this.uploadsService.uploadWithSseOverride(file, body)
  }
}
