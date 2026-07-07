/**
 * Unit: VaultService - vault download operations.
 *
 * Mocks `StorageService` directly. Covers: stream delegation, preview size
 * guard (pass + 413 rejection), byte-range string composition, versioned
 * bucket routing, and not-found propagation.
 *
 * @module vault/vault.service.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common'
import { StorageException } from '@bymax-one/nest-storage'
import type { StorageService, ObjectMetadata } from '@bymax-one/nest-storage'
import { VaultService } from './vault.service.js'

/** Minimal ObjectMetadata stub. */
function makeMetadata(overrides: Partial<ObjectMetadata> = {}): ObjectMetadata {
  return {
    key: 'storage-example/avatars/uuid.png',
    bucket: 'vault',
    size: 1024,
    contentType: 'image/png',
    etag: '"abc"',
    lastModified: new Date('2026-01-01'),
    metadata: {},
    ...overrides,
  }
}

/**
 * Builds the service with a mocked StorageService.
 *
 * @returns The service and the mock functions.
 */
function setup() {
  const download = jest.fn<StorageService['download']>()
  const downloadBuffer = jest.fn<StorageService['downloadBuffer']>()
  const head = jest.fn<StorageService['head']>()
  const storage = { download, downloadBuffer, head } as unknown as StorageService
  const service = new VaultService(storage)
  return { service, download, downloadBuffer, head }
}

describe('VaultService (unit)', () => {
  describe('download', () => {
    it('delegates to storage.download() and returns stream + metadata', async () => {
      /*
       * Scenario: streaming download of an existing object.
       * Rule it protects: the stream and metadata are returned without buffering.
       */
      const { service, download } = setup()
      const stream = { pipe: jest.fn() } as unknown as NodeJS.ReadableStream
      const metadata = makeMetadata()
      download.mockResolvedValue({ stream, metadata })

      const result = await service.download('avatars/uuid.png')
      expect(download).toHaveBeenCalledWith({ key: 'avatars/uuid.png' })
      expect(result.stream).toBe(stream)
      expect(result.metadata).toBe(metadata)
    })

    it('propagates StorageException from storage.download()', async () => {
      /*
       * Scenario: the library throws STORAGE_OBJECT_NOT_FOUND.
       * Rule it protects: the exception reaches the global filter unchanged.
       */
      const { service, download } = setup()
      download.mockRejectedValue(new StorageException('STORAGE_OBJECT_NOT_FOUND'))

      await expect(service.download('missing/key')).rejects.toBeInstanceOf(StorageException)
    })
  })

  describe('preview', () => {
    it('returns base64-encoded buffer and the metadata from the download result', async () => {
      /*
       * Scenario: 1 KiB object (under 10 MiB limit); head() and downloadBuffer()
       * report distinct metadata objects.
       * Rule it protects: head() guards size, but the returned metadata comes from
       * downloadBuffer() so it reflects the bytes actually returned (no stale head).
       */
      const { service, head, downloadBuffer } = setup()
      const headMetadata = makeMetadata({ size: 1024, etag: '"head-etag"' })
      const downloadMetadata = makeMetadata({ size: 1024, etag: '"download-etag"' })
      head.mockResolvedValue(headMetadata)
      downloadBuffer.mockResolvedValue({ buffer: Buffer.from('abc'), metadata: downloadMetadata })

      const result = await service.preview('avatars/uuid.png')
      expect(result.base64).toBe(Buffer.from('abc').toString('base64'))
      expect(result.metadata).toBe(downloadMetadata)
    })

    it('throws PayloadTooLargeException without downloading when size > 10 MiB', async () => {
      /*
       * Scenario: head() reports an 11 MiB object.
       * Rule it protects: downloadBuffer() is NEVER called for oversized objects.
       */
      const { service, head, downloadBuffer } = setup()
      head.mockResolvedValue(makeMetadata({ size: 11 * 1024 * 1024 }))

      await expect(service.preview('large/object.bin')).rejects.toBeInstanceOf(
        PayloadTooLargeException,
      )
      expect(downloadBuffer).not.toHaveBeenCalled()
    })

    it('propagates StorageException from head() (not-found)', async () => {
      /*
       * Scenario: the object doesn't exist; head() throws.
       * Rule it protects: STORAGE_OBJECT_NOT_FOUND reaches the filter.
       */
      const { service, head } = setup()
      head.mockRejectedValue(new StorageException('STORAGE_OBJECT_NOT_FOUND'))

      await expect(service.preview('missing.png')).rejects.toBeInstanceOf(StorageException)
    })
  })

  describe('downloadRange', () => {
    it('passes the bytes= range string to downloadBuffer()', async () => {
      /*
       * Scenario: range 0-15 (16 bytes).
       * Rule it protects: the range string is composed as 'bytes=0-15'.
       */
      const { service, downloadBuffer } = setup()
      const metadata = makeMetadata()
      downloadBuffer.mockResolvedValue({ buffer: Buffer.alloc(16), metadata })

      await service.downloadRange('my/key', 0, 15)

      expect(downloadBuffer).toHaveBeenCalledWith({ key: 'my/key', range: 'bytes=0-15' })
    })

    it('returns base64 of exactly the range buffer', async () => {
      /*
       * Scenario: 16-byte buffer is base64-encoded and returned.
       * Rule it protects: the base64 matches the downloaded bytes.
       */
      const { service, downloadBuffer } = setup()
      const buf = Buffer.from('0123456789abcdef')
      downloadBuffer.mockResolvedValue({ buffer: buf, metadata: makeMetadata() })

      const result = await service.downloadRange('my/key', 0, 15)
      expect(result.base64).toBe(buf.toString('base64'))
    })

    it('throws BadRequestException when start > end', async () => {
      /*
       * Scenario: caller supplies an inverted range (start=100, end=0).
       * Rule it protects: downloadBuffer() is not called for invalid ranges; 400 is
       * the correct HTTP status for an invalid parameter value, not 413.
       */
      const { service, downloadBuffer } = setup()

      await expect(service.downloadRange('my/key', 100, 0)).rejects.toBeInstanceOf(
        BadRequestException,
      )
      expect(downloadBuffer).not.toHaveBeenCalled()
    })

    it('throws PayloadTooLargeException when the range exceeds 50 MiB', async () => {
      /*
       * Scenario: caller requests a range larger than 50 MiB (start=0, end past cap).
       * Rule it protects: downloadBuffer() is not called for oversized ranges; a
       * size-limit breach is a 413, distinct from the 400 inverted-range case.
       */
      const { service, downloadBuffer } = setup()
      const FIFTY_MIB = 50 * 1024 * 1024

      await expect(service.downloadRange('my/key', 0, FIFTY_MIB + 1)).rejects.toBeInstanceOf(
        PayloadTooLargeException,
      )
      expect(downloadBuffer).not.toHaveBeenCalled()
    })
  })

  describe('downloadVersion', () => {
    it('targets the versioned bucket via the bucket option', async () => {
      /*
       * Scenario: version download routes to vault-versioned bucket.
       * Rule it protects: downloadBuffer receives the versioned bucket name.
       */
      const { service, downloadBuffer } = setup()
      const metadata = makeMetadata({ bucket: 'vault-versioned', versionId: 'v1' })
      downloadBuffer.mockResolvedValue({ buffer: Buffer.from('v1-content'), metadata })

      const result = await service.downloadVersion('my/key', 'vault-versioned')

      expect(downloadBuffer).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'my/key', bucket: 'vault-versioned' }),
      )
      expect(result.base64).toBe(Buffer.from('v1-content').toString('base64'))
    })

    it('propagates StorageException for a missing key in the versioned bucket', async () => {
      /*
       * Scenario: key not found in vault-versioned.
       * Rule it protects: STORAGE_OBJECT_NOT_FOUND propagates through the service.
       */
      const { service, downloadBuffer } = setup()
      downloadBuffer.mockRejectedValue(new StorageException('STORAGE_OBJECT_NOT_FOUND'))

      await expect(service.downloadVersion('missing', 'vault-versioned')).rejects.toBeInstanceOf(
        StorageException,
      )
    })
  })
})
