/**
 * @fileoverview Upload service. Owns all library `upload()` calls for the
 * uploads module: single-shot with header/metadata pass-through, SSE-override
 * (per-call `AES256` / `'NONE'` sentinel), multipart with bounded in-memory
 * progress sessions, streaming (known and unknown size), and idempotent
 * deduplication. Key composition is `{category}/{uuid}.{ext}` -- the library
 * prepends the global `keyPrefix`.
 * @layer api/uploads
 */
import { Injectable } from '@nestjs/common'
import { randomUUID, createHash } from 'node:crypto'
import type { StorageService, UploadOptions, UploadResult } from '@bymax-one/nest-storage'
import type { SingleUploadBody, SseOverrideBody } from './dto/single-upload.dto.js'
import type { MultipartUploadBody } from './dto/multipart-upload.dto.js'
import type { StreamUploadQuery } from './dto/stream-upload.dto.js'
import type { IdempotentUploadBody } from './dto/idempotent-upload.dto.js'
import type { ProgressSnapshot, UploadSessionStore } from './upload-session.store.js'

/** File as injected by multer memory storage. */
export interface MulterFile {
  fieldname: string
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

/**
 * Derives the file extension from the original filename. Returns an empty
 * string when no extension is present.
 *
 * @param originalname - The original filename from the uploaded file.
 * @returns The extension including the leading dot, or `''` when absent.
 */
function extractExtension(originalname: string): string {
  const dotIndex = originalname.lastIndexOf('.')
  return dotIndex >= 0 ? originalname.slice(dotIndex) : ''
}

/**
 * Builds upload options from header fields using spread to exclude `undefined`
 * values (required by `exactOptionalPropertyTypes`).
 *
 * @param file - The multer in-memory file.
 * @param body - Validated upload body with category and optional headers.
 * @param key - The composed object key.
 * @returns The upload options with only defined optional fields set.
 */
function buildBaseUploadOptions(
  file: MulterFile,
  body: SingleUploadBody,
  key: string,
): UploadOptions {
  const opts: UploadOptions = {
    key,
    body: file.buffer,
    contentType: file.mimetype,
    size: file.size,
  }
  if (body.cacheControl !== undefined) opts.cacheControl = body.cacheControl
  if (body.contentDisposition !== undefined) opts.contentDisposition = body.contentDisposition
  if (body.metadata !== undefined) opts.metadata = body.metadata
  return opts
}

/** Service orchestrating library upload calls for the uploads module. */
@Injectable()
export class UploadsService {
  constructor(
    private readonly storage: StorageService,
    private readonly sessions: UploadSessionStore,
  ) {}

  /**
   * Uploads a file from memory storage (single-shot or multipart depending on
   * size). Composes the key as `{category}/{uuid}{ext}`.
   *
   * @param file - The multer in-memory file.
   * @param body - Validated upload body with category and optional headers.
   * @returns The library upload result.
   */
  async uploadSingle(file: MulterFile, body: SingleUploadBody): Promise<UploadResult> {
    const key = `${body.category}/${randomUUID()}${extractExtension(file.originalname)}`
    return this.storage.upload(buildBaseUploadOptions(file, body, key))
  }

  /**
   * Uploads a file with a per-call SSE algorithm override. Passing `'NONE'`
   * forces no encryption even when a global default is configured (spec §12.1).
   *
   * @param file - The multer in-memory file.
   * @param body - Validated body including the `serverSideEncryption` field.
   * @returns The library upload result.
   */
  async uploadWithSseOverride(file: MulterFile, body: SseOverrideBody): Promise<UploadResult> {
    const key = `${body.category}/${randomUUID()}${extractExtension(file.originalname)}`
    const opts = buildBaseUploadOptions(file, body, key)
    opts.serverSideEncryption = body.serverSideEncryption
    return this.storage.upload(opts)
  }

  /**
   * Uploads a file while recording `onProgress` snapshots into an in-memory
   * session. The session ID is returned alongside the upload result so callers
   * can poll `GET /uploads/sessions/:id`.
   *
   * @param file - The multer in-memory file.
   * @param body - Validated upload body with category.
   * @returns The upload result and the session ID.
   */
  async uploadMultipart(
    file: MulterFile,
    body: MultipartUploadBody,
  ): Promise<{ sessionId: string; result: UploadResult }> {
    const sessionId = randomUUID()
    this.sessions.create(sessionId)
    const key = `${body.category}/${randomUUID()}${extractExtension(file.originalname)}`
    const result = await this.storage.upload({
      key,
      body: file.buffer,
      contentType: file.mimetype,
      size: file.size,
      onProgress: (event) => {
        const snapshot: ProgressSnapshot = { loaded: event.loaded }
        if (event.total !== undefined) snapshot.total = event.total
        if (event.part !== undefined) snapshot.part = event.part
        this.sessions.append(sessionId, snapshot)
      },
    })
    // Record a final snapshot with the resolved strategy.
    const finalSnapshot: ProgressSnapshot = {
      loaded: file.size,
      total: file.size,
      strategy: result.multipart ? 'multipart' : 'single',
    }
    this.sessions.append(sessionId, finalSnapshot)
    return { sessionId, result }
  }

  /**
   * Uploads a stream (readable) with optional size hint. When `knownSize` is
   * false the size is omitted, forcing the library to use the multipart path
   * regardless of the threshold (spec §12.2).
   *
   * @param stream - The raw readable stream from the request.
   * @param contentType - MIME type from the `Content-Type` header.
   * @param query - Validated query including category, knownSize, and filename.
   * @param contentLength - Byte count from `Content-Length`; undefined when absent.
   * @returns The upload result and the session ID.
   */
  async uploadStream(
    stream: NodeJS.ReadableStream,
    contentType: string,
    query: StreamUploadQuery,
    contentLength: number | undefined,
  ): Promise<{ sessionId: string; result: UploadResult }> {
    const sessionId = randomUUID()
    this.sessions.create(sessionId)
    const filename = query.filename ?? 'stream'
    const key = `${query.category}/${randomUUID()}${extractExtension(filename)}`
    const opts: UploadOptions = {
      key,
      body: stream,
      contentType,
      onProgress: (event) => {
        const snapshot: ProgressSnapshot = { loaded: event.loaded }
        if (event.total !== undefined) snapshot.total = event.total
        if (event.part !== undefined) snapshot.part = event.part
        this.sessions.append(sessionId, snapshot)
      },
    }
    if (query.knownSize && contentLength !== undefined) {
      opts.size = contentLength
    }
    const result = await this.storage.upload(opts)
    const finalSnapshot: ProgressSnapshot = { loaded: contentLength ?? 0 }
    if (contentLength !== undefined) finalSnapshot.total = contentLength
    finalSnapshot.strategy = result.multipart ? 'multipart' : 'single'
    this.sessions.append(sessionId, finalSnapshot)
    return { sessionId, result }
  }

  /**
   * Uploads a text buffer with an idempotency key. A second call with the
   * same key within the cache TTL returns the prior result without a provider
   * write. The per-instance boundary is stated in the response note rather
   * than hidden (spec §12.3).
   *
   * @param body - Validated body with `idempotencyKey`, `content`, and `contentType`.
   * @returns The upload result plus a note about the in-memory cache boundary.
   */
  async uploadIdempotent(
    body: IdempotentUploadBody,
  ): Promise<{ result: UploadResult; note: string }> {
    const keyHash = createHash('sha256').update(body.idempotencyKey).digest('hex').slice(0, 16)
    const key = `idempotent/${keyHash}.txt`
    const contentBuffer = Buffer.from(body.content, 'utf8')
    const result = await this.storage.upload({
      key,
      body: contentBuffer,
      contentType: body.contentType,
      size: contentBuffer.byteLength,
      idempotencyKey: body.idempotencyKey,
    })
    return {
      result,
      note: 'The idempotency cache is in-memory and per-instance. In multi-replica deployments two pods may upload the same key independently within the TTL window because they do not share state.',
    }
  }
}
