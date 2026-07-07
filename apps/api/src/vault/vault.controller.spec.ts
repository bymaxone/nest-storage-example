/**
 * Unit: VaultController - HTTP layer for vault download routes.
 *
 * Mocks `VaultService` and an injectable `ConfigService` stub. Covers: stream
 * route (headers set from metadata, pipe called), preview delegation, range
 * delegation, version delegation with requestedVersionId echo, route metadata
 * (verb + path), and not-found propagation.
 *
 * @module vault/vault.controller.spec
 */
import 'reflect-metadata'
import { Readable, Writable } from 'node:stream'
import { jest } from '@jest/globals'
import { RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { StorageException } from '@bymax-one/nest-storage'
import type { ObjectMetadata } from '@bymax-one/nest-storage'
import type { ConfigService } from '@nestjs/config'
import type { Response } from 'express'
import { VaultController } from './vault.controller.js'
import { VaultService } from './vault.service.js'
import type { Env } from '../config/env.schema.js'

/** NestJS route-metadata keys. */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/** Minimal ObjectMetadata stub. */
function makeMetadata(overrides: Partial<ObjectMetadata> = {}): ObjectMetadata {
  return {
    key: 'storage-example/avatars/uuid.png',
    bucket: 'vault',
    size: 512,
    contentType: 'image/png',
    etag: '"abc"',
    lastModified: new Date('2026-01-01'),
    metadata: {},
    ...overrides,
  }
}

/**
 * Real Writable response double with header tracking. `pipeline` requires a
 * genuine writable stream as its destination, so this collects written chunks
 * while exposing a `setHeader` spy. Returns the spy separately to avoid
 * unbound-method lint.
 */
function makeResponse() {
  const headers: Record<string, string | number> = {}
  const received: Buffer[] = []
  const setHeader = jest.fn((key: string, value: string | number) => {
    headers[key] = value
  })
  const writable = new Writable({
    write(chunk: Buffer, _encoding, callback): void {
      received.push(Buffer.from(chunk))
      callback()
    },
  })
  const res = Object.assign(writable, { setHeader }) as unknown as Response
  return { res, setHeader, received }
}

/**
 * Builds the controller with mocked service and config.
 *
 * @returns The controller plus mock functions.
 */
function setup() {
  const download = jest.fn<VaultService['download']>()
  const preview = jest.fn<VaultService['preview']>()
  const downloadRange = jest.fn<VaultService['downloadRange']>()
  const downloadVersion = jest.fn<VaultService['downloadVersion']>()
  const service = { download, preview, downloadRange, downloadVersion } as unknown as VaultService

  const env: Env = {
    NODE_ENV: 'test',
    PORT: 3001,
    WEB_ORIGIN: 'http://localhost:3000',
    STORAGE_ENDPOINT: 'http://localhost:9000',
    STORAGE_REGION: 'us-east-1',
    STORAGE_BUCKET: 'vault',
    STORAGE_ARCHIVE_BUCKET: 'vault-archive',
    STORAGE_VERSIONED_BUCKET: 'vault-versioned',
    STORAGE_ACCESS_KEY_ID: 'minioadmin',
    STORAGE_SECRET_ACCESS_KEY: 'minioadmin',
    STORAGE_FORCE_PATH_STYLE: true,
    STORAGE_PUBLIC_BASE_URL: 'http://localhost:9000/vault',
    STORAGE_CDN_BASE_URL: '',
    STORAGE_KEY_PREFIX: 'storage-example',
    STORAGE_SSE: '',
    STORAGE_CHECKSUM_MODE: 'WHEN_REQUIRED',
    STORAGE_MAX_TTL_SECONDS: 3600,
    STORAGE_MULTIPART_THRESHOLD: 5_242_880,
    SCANNER_MODE: 'pre-upload',
    SCANNER_REJECT_ON_UNKNOWN: false,
    UPLOAD_MAX_SIZE_BYTES: 26_214_400,
  }

  const config = {
    get: jest.fn(() => env),
  } as unknown as ConfigService<{ env: Env }, true>

  const controller = new VaultController(service, config)
  return { controller, download, preview, downloadRange, downloadVersion }
}

describe('VaultController (unit)', () => {
  describe('download (stream)', () => {
    it('sets Content-Type and Content-Length headers then streams the body', async () => {
      /*
       * Scenario: stream download of a 512-byte PNG.
       * Rule it protects: metadata headers are set BEFORE streaming, and the body
       * is piped through to the response via pipeline().
       */
      const { controller, download } = setup()
      const stream = Readable.from([Buffer.from('body-bytes')])
      const metadata = makeMetadata()
      download.mockResolvedValue({ stream, metadata })
      const { res, setHeader, received } = makeResponse()

      await controller.download({ key: 'avatars/uuid.png' }, res)

      expect(setHeader).toHaveBeenCalledWith('Content-Type', 'image/png')
      expect(setHeader).toHaveBeenCalledWith('Content-Length', 512)
      expect(Buffer.concat(received).toString()).toBe('body-bytes')
    })

    it('sets Content-Disposition when metadata provides it', async () => {
      /*
       * Scenario: metadata includes a content-disposition.
       * Rule it protects: the header is forwarded to the response.
       */
      const { controller, download } = setup()
      const stream = Readable.from([Buffer.from('x')])
      download.mockResolvedValue({
        stream,
        metadata: makeMetadata({ contentDisposition: 'attachment; filename="uuid.png"' }),
      })
      const { res, setHeader } = makeResponse()

      await controller.download({ key: 'avatars/uuid.png' }, res)

      expect(setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="uuid.png"',
      )
    })

    it('sets Cache-Control when metadata provides it', async () => {
      /*
       * Scenario: metadata includes a cache-control header.
       * Rule it protects: the Cache-Control header is forwarded to the response.
       */
      const { controller, download } = setup()
      const stream = Readable.from([Buffer.from('x')])
      download.mockResolvedValue({
        stream,
        metadata: makeMetadata({ cacheControl: 'public, max-age=3600' }),
      })
      const { res, setHeader } = makeResponse()

      await controller.download({ key: 'avatars/uuid.png' }, res)

      expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600')
    })

    it('rejects when the source stream errors mid-transfer', async () => {
      /*
       * Scenario: the library stream emits an error after headers were set.
       * Rule it protects: pipeline() surfaces the stream error as a rejected
       * promise (reaching the global filter) instead of crashing the process.
       */
      const { controller, download } = setup()
      const stream = new Readable({
        read(): void {
          this.destroy(new Error('stream boom'))
        },
      })
      download.mockResolvedValue({ stream, metadata: makeMetadata() })
      const { res } = makeResponse()

      await expect(controller.download({ key: 'avatars/uuid.png' }, res)).rejects.toThrow(
        'stream boom',
      )
    })

    it('propagates StorageException for a missing key', async () => {
      /*
       * Scenario: key not found; the global filter handles the exception.
       * Rule it protects: StorageException is not swallowed by the controller.
       */
      const { controller, download } = setup()
      download.mockRejectedValue(new StorageException('STORAGE_OBJECT_NOT_FOUND'))
      const { res } = makeResponse()

      await expect(controller.download({ key: 'ghost' }, res)).rejects.toBeInstanceOf(
        StorageException,
      )
    })
  })

  describe('preview', () => {
    it('delegates to the service and returns the result', async () => {
      /*
       * Scenario: preview of a small object.
       * Rule it protects: the controller passes the key and returns the payload.
       */
      const { controller, preview } = setup()
      const payload = { base64: 'aGVsbG8=', metadata: makeMetadata() }
      preview.mockResolvedValue(payload)

      const result = await controller.preview({ key: 'avatars/uuid.png' })
      expect(preview).toHaveBeenCalledWith('avatars/uuid.png')
      expect(result).toBe(payload)
    })
  })

  describe('downloadRange', () => {
    it('delegates start and end to the service', async () => {
      /*
       * Scenario: range query with start=0, end=15.
       * Rule it protects: both numbers are forwarded to downloadRange().
       */
      const { controller, downloadRange } = setup()
      const payload = { base64: 'AA==', metadata: makeMetadata() }
      downloadRange.mockResolvedValue(payload)

      const result = await controller.downloadRange({ key: 'my/key', start: 0, end: 15 })
      expect(downloadRange).toHaveBeenCalledWith('my/key', 0, 15)
      expect(result).toBe(payload)
    })
  })

  describe('downloadVersion', () => {
    it('passes the versioned bucket and echoes requestedVersionId', async () => {
      /*
       * Scenario: version download request.
       * Rule it protects: the versioned bucket is used and versionId is echoed.
       */
      const { controller, downloadVersion } = setup()
      const payload = { base64: 'dg==', metadata: makeMetadata({ versionId: 'v1' }) }
      downloadVersion.mockResolvedValue(payload)

      const result = await controller.downloadVersion({ key: 'doc.pdf', versionId: 'v1' })
      expect(downloadVersion).toHaveBeenCalledWith('doc.pdf', 'vault-versioned')
      expect(result).toMatchObject({ requestedVersionId: 'v1' })
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('declares GET download on the download handler', () => {
      /*
       * Scenario: inspect verb and path for the stream endpoint.
       * Rule it protects: route metadata is GET + 'download'.
       */
      const handler: keyof VaultController = 'download'
      const fn = VaultController.prototype[handler]
      expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(RequestMethod.GET)
      expect(reflector.get<string>(PATH_METADATA, fn)).toBe('download')
    })

    it('declares GET version on the downloadVersion handler', () => {
      /*
       * Scenario: inspect verb and path for the version endpoint.
       * Rule it protects: route metadata is GET + 'version'.
       */
      const handler: keyof VaultController = 'downloadVersion'
      const fn = VaultController.prototype[handler]
      expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(RequestMethod.GET)
      expect(reflector.get<string>(PATH_METADATA, fn)).toBe('version')
    })
  })
})
