/**
 * Unit: UploadsService - upload strategy orchestration.
 *
 * Mocks `StorageService` and `UploadSessionStore` directly (no Nest DI
 * container). Covers: key composition, option pass-through, SSE override,
 * multipart session creation and onProgress callback invocation, stream upload
 * with known/unknown size, and idempotent cache boundary note.
 *
 * @module uploads/uploads.service.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import type { StorageService, UploadResult } from '@bymax-one/nest-storage'
import { UploadsService } from './uploads.service.js'
import { UploadSessionStore } from './upload-session.store.js'
import type { MulterFile } from './uploads.service.js'

/** A minimal `UploadResult` stub for mock return values. */
function makeResult(overrides: Partial<UploadResult> = {}): UploadResult {
  return {
    key: 'storage-example/avatars/uuid.png',
    bucket: 'vault',
    etag: '"abc"',
    size: 100,
    contentType: 'image/png',
    publicUrl: 'http://localhost:9000/vault/storage-example/avatars/uuid.png',
    multipart: false,
    fromIdempotencyCache: false,
    ...overrides,
  }
}

/** Minimal multer in-memory file for tests. */
function makeFile(overrides: Partial<MulterFile> = {}): MulterFile {
  return {
    fieldname: 'file',
    originalname: 'photo.png',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('fake-image-data'),
    ...overrides,
  }
}

/**
 * Builds the service with mocked dependencies.
 *
 * @returns The service instance plus the mock functions.
 */
function setup() {
  const upload = jest.fn<StorageService['upload']>()
  const storage = { upload } as unknown as StorageService
  const sessions = new UploadSessionStore()
  const service = new UploadsService(storage, sessions)
  return { service, upload, sessions }
}

describe('UploadsService (unit)', () => {
  describe('uploadSingle', () => {
    it('passes buffer, contentType, size, and optional headers to the library', async () => {
      /*
       * Scenario: upload a file with cacheControl, contentDisposition, and metadata.
       * Rule it protects: every header field is forwarded to upload(); nothing is dropped.
       */
      const { service, upload } = setup()
      const result = makeResult()
      upload.mockResolvedValue(result)
      const file = makeFile()

      const returned = await service.uploadSingle(file, {
        category: 'avatars',
        cacheControl: 'public, max-age=3600',
        contentDisposition: 'inline',
        metadata: { role: 'avatar' },
      })

      const call = upload.mock.calls[0]?.[0]
      expect(call).toMatchObject({
        body: file.buffer,
        contentType: 'image/png',
        size: 1024,
        cacheControl: 'public, max-age=3600',
        contentDisposition: 'inline',
        metadata: { role: 'avatar' },
      })
      // Key starts with the category prefix.
      expect(call?.key).toMatch(/^avatars\//)
      expect(returned).toBe(result)
    })

    it('composes a key as {category}/{uuid}{ext} from originalname', async () => {
      /*
       * Scenario: upload file named "doc.pdf" under "invoices" category.
       * Rule it protects: the key uses the category and preserves the extension.
       */
      const { service, upload } = setup()
      upload.mockResolvedValue(makeResult())
      await service.uploadSingle(
        makeFile({ originalname: 'doc.pdf', mimetype: 'application/pdf' }),
        {
          category: 'invoices',
        },
      )
      const key = upload.mock.calls[0]?.[0]?.key
      expect(key).toMatch(/^invoices\/[0-9a-f-]{36}\.pdf$/)
    })

    it('handles files with no extension gracefully', async () => {
      /*
       * Scenario: originalname has no dot (e.g. "datafile").
       * Rule it protects: a missing extension produces no trailing dot.
       */
      const { service, upload } = setup()
      upload.mockResolvedValue(makeResult())
      await service.uploadSingle(makeFile({ originalname: 'datafile', mimetype: 'text/plain' }), {
        category: 'attachments',
      })
      const key = upload.mock.calls[0]?.[0]?.key
      // No trailing dot: the UUID alone follows the slash.
      expect(key).toMatch(/^attachments\/[0-9a-f-]{36}$/)
    })
  })

  describe('uploadWithSseOverride', () => {
    it('passes serverSideEncryption to the library', async () => {
      /*
       * Scenario: upload with AES256 override.
       * Rule it protects: the SSE value is forwarded unchanged to upload().
       */
      const { service, upload } = setup()
      upload.mockResolvedValue(makeResult())
      await service.uploadWithSseOverride(makeFile(), {
        category: 'avatars',
        serverSideEncryption: 'AES256',
      })
      expect(upload.mock.calls[0]?.[0]?.serverSideEncryption).toBe('AES256')
    })

    it("passes the 'NONE' sentinel to the library", async () => {
      /*
       * Scenario: upload with 'NONE' to disable the global SSE default.
       * Rule it protects: 'NONE' is not normalised or stripped.
       */
      const { service, upload } = setup()
      upload.mockResolvedValue(makeResult())
      await service.uploadWithSseOverride(makeFile(), {
        category: 'avatars',
        serverSideEncryption: 'NONE',
      })
      expect(upload.mock.calls[0]?.[0]?.serverSideEncryption).toBe('NONE')
    })
  })

  describe('uploadMultipart', () => {
    it('creates a session, records onProgress snapshots, and appends a final strategy snapshot', async () => {
      /*
       * Scenario: upload invokes onProgress twice; service appends both plus a final snapshot.
       * Rule it protects: all intermediate and final snapshots land in the session.
       */
      const { service, upload, sessions } = setup()
      const result = makeResult({ multipart: true })
      upload.mockImplementation((opts) => {
        // Simulate two part-progress events.
        opts.onProgress?.({ loaded: 1000, total: 2000, part: 1 })
        opts.onProgress?.({ loaded: 2000, total: 2000, part: 2 })
        return Promise.resolve(result)
      })

      const { sessionId } = await service.uploadMultipart(makeFile({ size: 2000 }), {
        category: 'media',
      })

      const snapshots = sessions.get(sessionId)
      // Two intermediate + one final.
      expect(snapshots).toHaveLength(3)
      expect(snapshots?.[0]).toMatchObject({ loaded: 1000, part: 1 })
      expect(snapshots?.[1]).toMatchObject({ loaded: 2000, part: 2 })
      expect(snapshots?.[2]).toMatchObject({ strategy: 'multipart' })
    })

    it('returns the upload result alongside the sessionId', async () => {
      /*
       * Scenario: service returns both the library result and the session id.
       * Rule it protects: callers can correlate the session with the upload.
       */
      const { service, upload } = setup()
      const result = makeResult({ multipart: false })
      upload.mockResolvedValue(result)

      const returned = await service.uploadMultipart(makeFile(), { category: 'avatars' })
      expect(returned.result).toBe(result)
      expect(typeof returned.sessionId).toBe('string')
    })

    it('handles an onProgress event without total or part (unknown-size upload)', async () => {
      /*
       * Scenario: onProgress fires with only `loaded` set (total/part absent).
       * Rule it protects: the snapshot omits total and part when they are undefined.
       */
      const { service, upload, sessions } = setup()
      const result = makeResult({ multipart: true })
      upload.mockImplementation((opts) => {
        // Simulate an event with no total or part.
        opts.onProgress?.({ loaded: 256 })
        return Promise.resolve(result)
      })

      const { sessionId } = await service.uploadMultipart(makeFile({ size: 512 }), {
        category: 'avatars',
      })

      const snapshots = sessions.get(sessionId)
      const firstSnap = snapshots?.[0]
      expect(firstSnap?.loaded).toBe(256)
      expect(firstSnap?.total).toBeUndefined()
      expect(firstSnap?.part).toBeUndefined()
    })
  })

  describe('uploadStream', () => {
    it('passes the stream and contentType; includes size when knownSize is true', async () => {
      /*
       * Scenario: knownSize=true, Content-Length header provides 5000.
       * Rule it protects: size is forwarded to upload() when knownSize is true.
       */
      const { service, upload } = setup()
      upload.mockResolvedValue(makeResult({ multipart: false }))
      const stream = { pipe: jest.fn() } as unknown as NodeJS.ReadableStream

      await service.uploadStream(stream, 'video/mp4', { category: 'media', knownSize: true }, 5000)

      const call = upload.mock.calls[0]?.[0]
      expect(call?.body).toBe(stream)
      expect(call?.contentType).toBe('video/mp4')
      expect(call?.size).toBe(5000)
    })

    it('omits size when knownSize is false, forcing the multipart path', async () => {
      /*
       * Scenario: knownSize=false drops size from the upload call.
       * Rule it protects: undefined size is passed when the caller requests unknown-size mode.
       */
      const { service, upload } = setup()
      upload.mockResolvedValue(makeResult({ multipart: true }))
      const stream = { pipe: jest.fn() } as unknown as NodeJS.ReadableStream

      await service.uploadStream(stream, 'video/mp4', { category: 'media', knownSize: false }, 5000)

      const call = upload.mock.calls[0]?.[0]
      expect(call?.size).toBeUndefined()
    })

    it('returns both sessionId and result', async () => {
      /*
       * Scenario: stream upload returns the full response shape.
       * Rule it protects: sessionId is present alongside the library result.
       */
      const { service, upload } = setup()
      const result = makeResult({ multipart: true })
      upload.mockResolvedValue(result)
      const stream = { pipe: jest.fn() } as unknown as NodeJS.ReadableStream

      const returned = await service.uploadStream(
        stream,
        'video/mp4',
        { category: 'media', knownSize: true },
        100,
      )
      expect(returned.result).toBe(result)
      expect(typeof returned.sessionId).toBe('string')
    })

    it('records onProgress snapshots from stream upload into the session', async () => {
      /*
       * Scenario: library emits two onProgress events during stream upload.
       * Rule it protects: the onProgress callback appends snapshots to the session.
       */
      const { service, upload, sessions } = setup()
      const result = makeResult({ multipart: true })
      upload.mockImplementation((opts) => {
        opts.onProgress?.({ loaded: 512, total: 1024, part: 1 })
        opts.onProgress?.({ loaded: 1024, total: 1024, part: 2 })
        return Promise.resolve(result)
      })
      const stream = { pipe: jest.fn() } as unknown as NodeJS.ReadableStream

      const { sessionId } = await service.uploadStream(
        stream,
        'video/mp4',
        { category: 'media', knownSize: true },
        1024,
      )

      const snapshots = sessions.get(sessionId)
      // Two intermediate + one final.
      expect(snapshots).toHaveLength(3)
      expect(snapshots?.[0]).toMatchObject({ loaded: 512, total: 1024, part: 1 })
      expect(snapshots?.[1]).toMatchObject({ loaded: 1024, total: 1024, part: 2 })
      expect(snapshots?.[2]).toMatchObject({ strategy: 'multipart' })
    })

    it('handles onProgress without total/part and records a final snapshot without total when contentLength is absent', async () => {
      /*
       * Scenario: unknown-size stream (no Content-Length); onProgress fires without total/part.
       * Rule it protects: the snapshot and final entry handle undefined gracefully.
       */
      const { service, upload, sessions } = setup()
      const result = makeResult({ multipart: true })
      upload.mockImplementation((opts) => {
        opts.onProgress?.({ loaded: 128 })
        return Promise.resolve(result)
      })
      const stream = { pipe: jest.fn() } as unknown as NodeJS.ReadableStream

      const { sessionId } = await service.uploadStream(
        stream,
        'video/mp4',
        { category: 'media', knownSize: false },
        undefined,
      )

      const snapshots = sessions.get(sessionId)
      const firstSnap = snapshots?.[0]
      expect(firstSnap?.loaded).toBe(128)
      expect(firstSnap?.total).toBeUndefined()
      expect(firstSnap?.part).toBeUndefined()
      const finalSnap = snapshots?.[snapshots.length - 1]
      expect(finalSnap?.total).toBeUndefined()
      expect(finalSnap?.loaded).toBe(0)
    })
  })

  describe('uploadIdempotent', () => {
    it('passes idempotencyKey to upload() and includes the per-instance note', async () => {
      /*
       * Scenario: first call with an idempotency key; library returns fromIdempotencyCache:false.
       * Rule it protects: the key is forwarded and the boundary note is present.
       */
      const { service, upload } = setup()
      const result = makeResult({ fromIdempotencyCache: false })
      upload.mockResolvedValue(result)

      const returned = await service.uploadIdempotent({
        idempotencyKey: 'unique-key-abc',
        content: 'Hello world',
        contentType: 'text/plain',
      })

      expect(upload.mock.calls[0]?.[0]?.idempotencyKey).toBe('unique-key-abc')
      expect(returned.result).toBe(result)
      expect(returned.note).toContain('in-memory')
      expect(returned.note).toContain('per-instance')
    })

    it('surfaces fromIdempotencyCache:true on a duplicate key', async () => {
      /*
       * Scenario: second call returns cached result.
       * Rule it protects: the library's cache flag is passed through.
       */
      const { service, upload } = setup()
      const cached = makeResult({ fromIdempotencyCache: true })
      upload.mockResolvedValue(cached)

      const returned = await service.uploadIdempotent({
        idempotencyKey: 'unique-key-abc',
        content: 'Hello world',
        contentType: 'text/plain',
      })

      expect(returned.result.fromIdempotencyCache).toBe(true)
    })

    it('keys the object under idempotent/{hash}.txt', async () => {
      /*
       * Scenario: verify the key prefix for idempotent uploads.
       * Rule it protects: the key starts with 'idempotent/' and ends in '.txt'.
       */
      const { service, upload } = setup()
      upload.mockResolvedValue(makeResult())

      await service.uploadIdempotent({
        idempotencyKey: 'my-key',
        content: 'data',
        contentType: 'text/plain',
      })

      const key = upload.mock.calls[0]?.[0]?.key
      expect(key).toMatch(/^idempotent\/[0-9a-f]{16}\.txt$/)
    })
  })
})
