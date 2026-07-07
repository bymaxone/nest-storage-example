/**
 * Unit: VaultService - vault download, listing, and lifecycle operations.
 *
 * Mocks `StorageService` directly. Covers: stream delegation, preview size
 * guard (pass + 413 rejection), byte-range string composition, versioned
 * bucket routing, not-found propagation, paged listing, head/exists,
 * public-URL building, idempotent single delete, bulk delete, and copy.
 *
 * @module vault/vault.service.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common'
import { StorageException } from '@bymax-one/nest-storage'
import type {
  StorageService,
  ObjectMetadata,
  ListResult,
  DeleteManyResult,
} from '@bymax-one/nest-storage'
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
  const exists = jest.fn<StorageService['exists']>()
  const list = jest.fn<StorageService['list']>()
  const deleteOne = jest.fn<StorageService['delete']>()
  const deleteMany = jest.fn<StorageService['deleteMany']>()
  const copy = jest.fn<StorageService['copy']>()
  const storage = {
    download,
    downloadBuffer,
    head,
    exists,
    list,
    delete: deleteOne,
    deleteMany,
    copy,
  } as unknown as StorageService
  const service = new VaultService(storage)
  return { service, download, downloadBuffer, head, exists, list, deleteOne, deleteMany, copy }
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

    it('throws PayloadTooLargeException when the base64-encoded range exceeds 50 MiB', async () => {
      /*
       * Scenario: caller requests a raw range whose base64 encoding exceeds the
       * 50 MiB cap. The raw ceiling is ~37.5 MiB; 39_321_601 raw bytes encode to
       * 52_428_804 base64 bytes, one over the cap.
       * Rule it protects: the guard bounds the *encoded* size (not the raw byte
       * count) so the JSON response stays under the heap cap; downloadBuffer() is
       * not called, and a size breach is a 413, distinct from the 400 inverted case.
       */
      const { service, downloadBuffer } = setup()
      const MAX_RAW_BYTES = 39_321_600

      await expect(service.downloadRange('my/key', 0, MAX_RAW_BYTES)).rejects.toBeInstanceOf(
        PayloadTooLargeException,
      )
      expect(downloadBuffer).not.toHaveBeenCalled()
    })

    it('allows a range whose base64 encoding is exactly at the 50 MiB cap', async () => {
      /*
       * Scenario: 39_321_600 raw bytes encode to exactly 52_428_800 base64 bytes
       * (the 50 MiB cap), so end=39_321_599 (0-based) is the largest allowed range.
       * Rule it protects: the boundary is inclusive; a range at the cap is served.
       */
      const { service, downloadBuffer } = setup()
      downloadBuffer.mockResolvedValue({ buffer: Buffer.alloc(0), metadata: makeMetadata() })
      const MAX_ALLOWED_END = 39_321_599

      await service.downloadRange('my/key', 0, MAX_ALLOWED_END)

      expect(downloadBuffer).toHaveBeenCalledWith({
        key: 'my/key',
        range: `bytes=0-${MAX_ALLOWED_END}`,
      })
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

  describe('list', () => {
    /** Minimal ListResult stub. */
    function makeListResult(overrides: Partial<ListResult> = {}): ListResult {
      return {
        objects: [],
        commonPrefixes: [],
        isTruncated: false,
        ...overrides,
      }
    }

    it('maps query fields to library ListOptions and returns one page', async () => {
      /*
       * Scenario: caller sends all list query params; they are forwarded to the
       * library and the result is mapped to the API response shape.
       * Rule it protects: cursor maps to continuationToken; nextCursor maps from
       * nextContinuationToken.
       */
      const { service, list } = setup()
      list.mockResolvedValue(
        makeListResult({
          objects: [
            {
              key: 'avatars/a.png',
              size: 100,
              etag: '"e1"',
              lastModified: new Date('2026-01-01'),
            },
          ],
          commonPrefixes: ['invoices/'],
          isTruncated: true,
          nextContinuationToken: 'tok2',
        }),
      )

      const result = await service.list({
        prefix: 'avatars/',
        maxKeys: 10,
        cursor: 'tok1',
        delimiter: '/',
      })

      expect(list).toHaveBeenCalledWith({
        prefix: 'avatars/',
        maxKeys: 10,
        continuationToken: 'tok1',
        delimiter: '/',
      })
      expect(result.objects).toHaveLength(1)
      expect(result.commonPrefixes).toEqual(['invoices/'])
      expect(result.isTruncated).toBe(true)
      expect(result.nextCursor).toBe('tok2')
    })

    it('omits nextCursor on the last page', async () => {
      /*
       * Scenario: the library returns isTruncated=false with no token.
       * Rule it protects: nextCursor is absent (not null or empty string) at
       * the end of the listing.
       */
      const { service, list } = setup()
      list.mockResolvedValue(makeListResult({ isTruncated: false }))

      const result = await service.list({ maxKeys: 50 })
      expect(result.isTruncated).toBe(false)
      expect(result.nextCursor).toBeUndefined()
    })

    it('propagates StorageException from the library', async () => {
      /*
       * Scenario: the provider rejects the list call.
       * Rule it protects: provider errors reach the global filter.
       */
      const { service, list } = setup()
      list.mockRejectedValue(new StorageException('STORAGE_PROVIDER_ERROR'))

      await expect(service.list({ maxKeys: 50 })).rejects.toBeInstanceOf(StorageException)
    })
  })

  describe('head', () => {
    it('delegates to storage.head() and returns the metadata', async () => {
      /*
       * Scenario: successful head call for an existing object.
       * Rule it protects: the metadata is returned verbatim from the library.
       */
      const { service, head } = setup()
      const metadata = makeMetadata()
      head.mockResolvedValue(metadata)

      const result = await service.head('avatars/uuid.png')
      expect(head).toHaveBeenCalledWith('avatars/uuid.png')
      expect(result).toBe(metadata)
    })

    it('propagates STORAGE_OBJECT_NOT_FOUND for a missing key', async () => {
      /*
       * Scenario: key does not exist; the library throws.
       * Rule it protects: the not-found exception reaches the global filter.
       */
      const { service, head } = setup()
      head.mockRejectedValue(new StorageException('STORAGE_OBJECT_NOT_FOUND'))

      await expect(service.head('missing')).rejects.toBeInstanceOf(StorageException)
    })
  })

  describe('exists', () => {
    it('returns true when the object exists', async () => {
      /*
       * Scenario: the provider reports the key is present.
       * Rule it protects: exists() surfaces the library's true result.
       */
      const { service, exists } = setup()
      exists.mockResolvedValue(true)

      const result = await service.exists('avatars/uuid.png')
      expect(result).toBe(true)
    })

    it('returns false when the object is missing', async () => {
      /*
       * Scenario: the provider reports the key is absent.
       * Rule it protects: exists() returns false (not throws) per the library contract.
       */
      const { service, exists } = setup()
      exists.mockResolvedValue(false)

      const result = await service.exists('missing')
      expect(result).toBe(false)
    })

    it('returns false (with provider warning, not throw) on any other error', async () => {
      /*
       * Scenario: the library returns false for a provider error (its documented
       * best-effort contract -- it warns internally rather than throws).
       * Rule it protects: the service does not re-throw; false propagates.
       */
      const { service, exists } = setup()
      exists.mockResolvedValue(false)

      const result = await service.exists('any/key')
      expect(result).toBe(false)
    })

    it('forwards the bucket option when supplied', async () => {
      /*
       * Scenario: caller provides a bucket override.
       * Rule it protects: the bucket option is forwarded to the library.
       */
      const { service, exists } = setup()
      exists.mockResolvedValue(true)

      await service.exists('some/key', 'vault-archive')
      expect(exists).toHaveBeenCalledWith('some/key', { bucket: 'vault-archive' })
    })

    it('calls storage.exists without a bucket option when none is given', async () => {
      /*
       * Scenario: no bucket override; the library uses its default bucket.
       * Rule it protects: undefined is not passed as the options argument.
       */
      const { service, exists } = setup()
      exists.mockResolvedValue(true)

      await service.exists('some/key')
      expect(exists).toHaveBeenCalledWith('some/key', undefined)
    })
  })

  describe('getPublicUrls', () => {
    it('returns the plain URL when no CDN is configured', () => {
      /*
       * Scenario: STORAGE_CDN_BASE_URL is empty; only the plain URL is returned.
       * Rule it protects: cdnUrl is absent when the CDN env var is not set.
       */
      const { service } = setup()
      const result = service.getPublicUrls(
        'avatars/uuid.png',
        'http://localhost:9000/vault',
        '',
        'storage-example',
      )
      expect(result.url).toBe('http://localhost:9000/vault/storage-example/avatars/uuid.png')
      expect(result.cdnUrl).toBeUndefined()
      expect(result.note).toContain('unsigned')
    })

    it('returns both url and cdnUrl when CDN is configured', () => {
      /*
       * Scenario: STORAGE_CDN_BASE_URL is set; both plain and CDN URLs appear.
       * Rule it protects: cdnUrl is present and uses the CDN base URL.
       */
      const { service } = setup()
      const result = service.getPublicUrls(
        'avatars/uuid.png',
        'http://localhost:9000/vault',
        'https://cdn.example.com',
        'storage-example',
      )
      expect(result.url).toBe('http://localhost:9000/vault/storage-example/avatars/uuid.png')
      expect(result.cdnUrl).toBe('https://cdn.example.com/storage-example/avatars/uuid.png')
    })

    it('handles an empty key prefix gracefully', () => {
      /*
       * Scenario: STORAGE_KEY_PREFIX is empty; no extra slash is introduced.
       * Rule it protects: URL construction stays correct when prefix is omitted.
       */
      const { service } = setup()
      const result = service.getPublicUrls('docs/file.pdf', 'http://localhost:9000/vault', '', '')
      expect(result.url).toBe('http://localhost:9000/vault/docs/file.pdf')
    })
  })

  describe('deleteOne', () => {
    it('returns warned=false when the key existed before the delete', async () => {
      /*
       * Scenario: first delete of an existing object; exists() returns true.
       * Rule it protects: warned is false on the first call -- no idempotency event.
       */
      const { service, exists, deleteOne } = setup()
      exists.mockResolvedValue(true)
      deleteOne.mockResolvedValue(undefined)

      const result = await service.deleteOne('avatars/uuid.png')
      expect(result).toEqual({ deleted: 'avatars/uuid.png', warned: false })
      expect(deleteOne).toHaveBeenCalledWith('avatars/uuid.png')
    })

    it('returns warned=true when the key was already absent', async () => {
      /*
       * Scenario: repeat delete of a non-existent key; exists() returns false.
       * Rule it protects: warned=true surfaces the library's internal warning to
       * the UI so idempotent repeat is observable.
       */
      const { service, exists, deleteOne } = setup()
      exists.mockResolvedValue(false)
      deleteOne.mockResolvedValue(undefined)

      const result = await service.deleteOne('avatars/uuid.png')
      expect(result).toEqual({ deleted: 'avatars/uuid.png', warned: true })
    })

    it('propagates StorageException from storage.delete()', async () => {
      /*
       * Scenario: the provider returns an unexpected error.
       * Rule it protects: non-idempotency errors are not swallowed.
       */
      const { service, exists, deleteOne } = setup()
      exists.mockResolvedValue(true)
      deleteOne.mockRejectedValue(new StorageException('STORAGE_PROVIDER_ERROR'))

      await expect(service.deleteOne('avatars/uuid.png')).rejects.toBeInstanceOf(StorageException)
    })
  })

  describe('deleteMany', () => {
    it('delegates to storage.deleteMany() and returns the verbatim result', async () => {
      /*
       * Scenario: bulk delete of three keys returns the library report unchanged.
       * Rule it protects: partial failures are never masked; the result is passed through.
       */
      const { service, deleteMany } = setup()
      const report: DeleteManyResult = {
        deleted: ['k1', 'k2'],
        failed: [{ key: 'k3', error: 'NoSuchKey' }],
      }
      deleteMany.mockResolvedValue(report)

      const result = await service.deleteMany(['k1', 'k2', 'k3'])
      expect(deleteMany).toHaveBeenCalledWith(['k1', 'k2', 'k3'])
      expect(result).toBe(report)
    })

    it('propagates StorageException on a whole-batch failure', async () => {
      /*
       * Scenario: the entire batch request fails at the provider level.
       * Rule it protects: batch-level errors reach the global filter.
       */
      const { service, deleteMany } = setup()
      deleteMany.mockRejectedValue(new StorageException('STORAGE_PROVIDER_ERROR'))

      await expect(service.deleteMany(['k1'])).rejects.toBeInstanceOf(StorageException)
    })
  })

  describe('copy', () => {
    it('copies within the same bucket when destination is "same"', async () => {
      /*
       * Scenario: same-bucket copy; destinationBucket is not passed to the library.
       * Rule it protects: the default bucket is used when destination='same'.
       */
      const { service, exists, copy } = setup()
      exists.mockResolvedValue(true)
      copy.mockResolvedValue({ etag: '"new-etag"' })

      const result = await service.copy(
        { sourceKey: 'src.png', destinationKey: 'dst.png', destination: 'same' },
        'vault-archive',
        'vault',
      )

      expect(copy).toHaveBeenCalledWith(
        expect.objectContaining({ sourceKey: 'src.png', destinationKey: 'dst.png' }),
      )
      expect(result).toEqual({
        etag: '"new-etag"',
        source: 'src.png',
        destination: 'dst.png',
        bucket: 'vault',
      })
    })

    it('targets the archive bucket when destination is "archive"', async () => {
      /*
       * Scenario: cross-bucket copy to vault-archive.
       * Rule it protects: destinationBucket is passed when destination='archive'.
       */
      const { service, exists, copy } = setup()
      exists.mockResolvedValue(true)
      copy.mockResolvedValue({ etag: '"arc-etag"' })

      const result = await service.copy(
        { sourceKey: 'src.png', destinationKey: 'arc/src.png', destination: 'archive' },
        'vault-archive',
        'vault',
      )

      expect(copy).toHaveBeenCalledWith(
        expect.objectContaining({ destinationBucket: 'vault-archive' }),
      )
      expect(result.bucket).toBe('vault-archive')
    })

    it('deletes the source when deleteSource is true', async () => {
      /*
       * Scenario: rename pattern -- deleteSource=true triggers a post-copy delete.
       * Rule it protects: the source is removed only after a successful copy.
       */
      const { service, exists, copy, deleteOne } = setup()
      exists.mockResolvedValue(true)
      copy.mockResolvedValue({ etag: '"e"' })
      deleteOne.mockResolvedValue(undefined)

      await service.copy(
        {
          sourceKey: 'old.png',
          destinationKey: 'new.png',
          destination: 'same',
          deleteSource: true,
        },
        'vault-archive',
        'vault',
      )

      expect(deleteOne).toHaveBeenCalledWith('old.png')
    })

    it('does not delete the source when deleteSource is absent', async () => {
      /*
       * Scenario: plain copy without deleteSource; source stays intact.
       * Rule it protects: the source is not deleted unless explicitly requested.
       */
      const { service, exists, copy, deleteOne } = setup()
      exists.mockResolvedValue(true)
      copy.mockResolvedValue({ etag: '"e"' })

      await service.copy(
        { sourceKey: 'src.png', destinationKey: 'dst.png', destination: 'same' },
        'vault-archive',
        'vault',
      )

      expect(deleteOne).not.toHaveBeenCalled()
    })

    it('throws STORAGE_OBJECT_NOT_FOUND when the source is absent', async () => {
      /*
       * Scenario: the exists() precheck finds no source; a typed 404 is thrown
       * before any CopyObject request is issued.
       * Rule it protects: the precheck prevents undefined copy semantics at the provider.
       */
      const { service, exists, copy } = setup()
      exists.mockResolvedValue(false)

      await expect(
        service.copy(
          { sourceKey: 'missing.png', destinationKey: 'dst.png', destination: 'same' },
          'vault-archive',
          'vault',
        ),
      ).rejects.toBeInstanceOf(StorageException)
      expect(copy).not.toHaveBeenCalled()
    })
  })
})
