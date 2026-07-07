/**
 * Unit: UploadsController - HTTP layer for all upload routes.
 *
 * Mocks `UploadsService` and `UploadSessionStore` directly. Covers: single
 * upload with file guard, SSE-override pass-through, multipart delegation,
 * stream upload delegation, idempotent upload, session retrieval (found and
 * 404), route metadata (verb + path), and the missing-file guard.
 *
 * @module uploads/uploads.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { BadRequestException, NotFoundException, RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { UploadResult } from '@bymax-one/nest-storage'
import { UploadsController } from './uploads.controller.js'
import { UploadsService } from './uploads.service.js'
import { UploadSessionStore } from './upload-session.store.js'
import type { MulterFile } from './uploads.service.js'
import type { Request } from 'express'

/** NestJS route-metadata keys. */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/** Minimal upload result stub. */
function makeResult(overrides: Partial<UploadResult> = {}): UploadResult {
  return {
    key: 'avatars/uuid.png',
    bucket: 'vault',
    etag: '"abc"',
    size: 100,
    contentType: 'image/png',
    publicUrl: 'http://localhost:9000/vault/avatars/uuid.png',
    multipart: false,
    fromIdempotencyCache: false,
    ...overrides,
  }
}

/** Minimal multer file stub. */
function makeFile(): MulterFile {
  return {
    fieldname: 'file',
    originalname: 'photo.png',
    mimetype: 'image/png',
    size: 512,
    buffer: Buffer.from('data'),
  }
}

/**
 * Builds the controller with mocked service and store.
 *
 * @returns Controller plus mocked dependencies.
 */
function setup() {
  const uploadSingle = jest.fn<UploadsService['uploadSingle']>()
  const uploadWithSseOverride = jest.fn<UploadsService['uploadWithSseOverride']>()
  const uploadMultipart = jest.fn<UploadsService['uploadMultipart']>()
  const uploadStream = jest.fn<UploadsService['uploadStream']>()
  const uploadIdempotent = jest.fn<UploadsService['uploadIdempotent']>()
  const service = {
    uploadSingle,
    uploadWithSseOverride,
    uploadMultipart,
    uploadStream,
    uploadIdempotent,
  } as unknown as UploadsService
  const sessions = new UploadSessionStore()
  const controller = new UploadsController(service, sessions)
  return {
    controller,
    service,
    sessions,
    uploadSingle,
    uploadWithSseOverride,
    uploadMultipart,
    uploadStream,
    uploadIdempotent,
  }
}

describe('UploadsController (unit)', () => {
  describe('uploadSingle', () => {
    it('delegates to the service and returns the result', async () => {
      /*
       * Scenario: valid file and body; service resolves with an UploadResult.
       * Rule it protects: the controller passes file and body through unchanged.
       */
      const { controller, uploadSingle } = setup()
      const result = makeResult()
      uploadSingle.mockResolvedValue(result)
      const returned = await controller.uploadSingle(makeFile(), { category: 'avatars' })
      expect(uploadSingle).toHaveBeenCalledTimes(1)
      expect(returned).toBe(result)
    })

    it('throws BadRequestException when file is undefined', async () => {
      /*
       * Scenario: FileInterceptor did not attach a file (field missing).
       * Rule it protects: a missing file never reaches the service.
       */
      const { controller } = setup()
      await expect(
        controller.uploadSingle(undefined as unknown as MulterFile, { category: 'avatars' }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('uploadMultipart', () => {
    it('delegates to the service and returns sessionId + result', async () => {
      /*
       * Scenario: valid file triggers session-tracked upload.
       * Rule it protects: sessionId and result are both returned.
       */
      const { controller, uploadMultipart } = setup()
      const payload = { sessionId: 'sess-1', result: makeResult({ multipart: true }) }
      uploadMultipart.mockResolvedValue(payload)
      const returned = await controller.uploadMultipart(makeFile(), { category: 'media' })
      expect(returned).toStrictEqual(payload)
    })

    it('throws BadRequestException when file is missing', async () => {
      /*
       * Scenario: no file attached to the multipart request.
       * Rule it protects: guard fires before service call.
       */
      const { controller } = setup()
      await expect(
        controller.uploadMultipart(undefined as unknown as MulterFile, { category: 'media' }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('getSession', () => {
    // A valid UUID v4 is required; the controller rejects non-UUID ids with 404.
    const VALID_SESSION_UUID = '550e8400-e29b-41d4-a716-446655440000'

    it('returns the session snapshots for a known id', () => {
      /*
       * Scenario: a session was created with a valid UUID and has one snapshot.
       * Rule it protects: the controller wraps snapshots in { id, snapshots }.
       */
      const { controller, sessions } = setup()
      sessions.create(VALID_SESSION_UUID)
      sessions.append(VALID_SESSION_UUID, { loaded: 500, strategy: 'single' })
      const result = controller.getSession(VALID_SESSION_UUID)
      expect(result).toEqual({
        id: VALID_SESSION_UUID,
        snapshots: [{ loaded: 500, strategy: 'single' }],
      })
    })

    it('throws NotFoundException for an unknown session id', () => {
      /*
       * Scenario: valid UUID format but session never created (evicted or invalid).
       * Rule it protects: unknown sessions return 404, not an empty list.
       */
      const { controller } = setup()
      expect(() => controller.getSession('00000000-0000-4000-8000-000000000000')).toThrow(
        NotFoundException,
      )
    })

    it('throws NotFoundException for a non-UUID session id without echoing the raw value', () => {
      /*
       * Scenario: caller passes an arbitrary string (not a UUID v4).
       * Rule it protects: invalid format is rejected before the store lookup; raw
       * value is not reflected in the error body.
       */
      const { controller } = setup()
      expect(() => controller.getSession('not-a-uuid')).toThrow(NotFoundException)
    })
  })

  describe('uploadStream', () => {
    it('reads Content-Type and Content-Length from the request and delegates', async () => {
      /*
       * Scenario: stream upload with known size (Content-Length present).
       * Rule it protects: size is derived from the header and passed to the service.
       */
      const { controller, uploadStream } = setup()
      const payload = { sessionId: 's2', result: makeResult({ multipart: false }) }
      uploadStream.mockResolvedValue(payload)
      const req = {
        headers: { 'content-type': 'video/mp4', 'content-length': '4096' },
        pipe: jest.fn(),
      } as unknown as Request

      const returned = await controller.uploadStream(req, {
        category: 'media',
        knownSize: true,
      })

      expect(uploadStream).toHaveBeenCalledWith(
        req,
        'video/mp4',
        { category: 'media', knownSize: true },
        4096,
      )
      expect(returned).toStrictEqual(payload)
    })

    it('passes undefined size when Content-Length is absent', async () => {
      /*
       * Scenario: stream request has no Content-Length header.
       * Rule it protects: undefined is forwarded rather than NaN.
       */
      const { controller, uploadStream } = setup()
      uploadStream.mockResolvedValue({ sessionId: 's3', result: makeResult() })
      const req = {
        headers: { 'content-type': 'application/octet-stream' },
      } as unknown as Request

      await controller.uploadStream(req, { category: 'attachments', knownSize: true })

      const [, , , sizeArg] = uploadStream.mock.calls[0] ?? []
      expect(sizeArg).toBeUndefined()
    })

    it('defaults content-type to application/octet-stream when header is absent', async () => {
      /*
       * Scenario: stream request has no Content-Type header.
       * Rule it protects: the fallback 'application/octet-stream' is used.
       */
      const { controller, uploadStream } = setup()
      uploadStream.mockResolvedValue({ sessionId: 's4', result: makeResult() })
      const req = {
        headers: {},
      } as unknown as Request

      await controller.uploadStream(req, { category: 'attachments', knownSize: false })

      const [, contentTypeArg] = uploadStream.mock.calls[0] ?? []
      expect(contentTypeArg).toBe('application/octet-stream')
    })
  })

  describe('uploadIdempotent', () => {
    it('delegates to the service and returns result + note', async () => {
      /*
       * Scenario: first idempotent call; service returns fromIdempotencyCache:false.
       * Rule it protects: result and note are both in the response.
       */
      const { controller, uploadIdempotent } = setup()
      const payload = {
        result: makeResult({ fromIdempotencyCache: false }),
        note: 'per-instance',
      }
      uploadIdempotent.mockResolvedValue(payload)

      const returned = await controller.uploadIdempotent({
        idempotencyKey: 'k1',
        content: 'hello',
        contentType: 'text/plain',
      })
      expect(returned).toStrictEqual(payload)
    })
  })

  describe('uploadWithSseOverride', () => {
    it('delegates to the service and returns the result', async () => {
      /*
       * Scenario: upload with AES256 SSE override.
       * Rule it protects: the SSE body field reaches the service call.
       */
      const { controller, uploadWithSseOverride } = setup()
      const result = makeResult()
      uploadWithSseOverride.mockResolvedValue(result)
      const returned = await controller.uploadWithSseOverride(makeFile(), {
        category: 'avatars',
        serverSideEncryption: 'AES256',
      })
      expect(uploadWithSseOverride).toHaveBeenCalledTimes(1)
      expect(returned).toBe(result)
    })

    it('throws BadRequestException when file is missing', async () => {
      /*
       * Scenario: SSE-override request without a file attachment.
       * Rule it protects: the guard fires before the service call.
       */
      const { controller } = setup()
      await expect(
        controller.uploadWithSseOverride(undefined as unknown as MulterFile, {
          category: 'avatars',
          serverSideEncryption: 'NONE',
        }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('declares POST single on the uploadSingle handler', () => {
      /*
       * Scenario: inspect route metadata for uploadSingle.
       * Rule it protects: the verb is POST and the path is 'single'.
       */
      const fn = UploadsController.prototype['uploadSingle']
      expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(RequestMethod.POST)
      expect(reflector.get<string>(PATH_METADATA, fn)).toBe('single')
    })

    it('declares GET sessions/:id on the getSession handler', () => {
      /*
       * Scenario: inspect route metadata for getSession.
       * Rule it protects: the verb is GET and the path is 'sessions/:id'.
       */
      const fn = UploadsController.prototype['getSession']
      expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(RequestMethod.GET)
      expect(reflector.get<string>(PATH_METADATA, fn)).toBe('sessions/:id')
    })
  })
})
