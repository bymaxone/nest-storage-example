/**
 * Unit: QuirksService - the three provider-quirk demonstrations.
 *
 * Mocks the running storage, the scoped factory, and the resolved options. Covers
 * the checksum demo when the two modes diverge and when they agree (the honest
 * version-dependent case), the non-StorageException rethrow, and the static ACL
 * and network cards including the requestTimeoutMs caveat.
 *
 * @module system/quirks.service.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { StorageException } from '@bymax-one/nest-storage'
import type { StorageService, UploadResult } from '@bymax-one/nest-storage'
import { QuirksService, type QuirksResolvedOptions } from './quirks.service.js'
import type { ScopedStorageFactory } from '../common/scoped-storage.factory.js'

/** Resolved options view injected into the service. */
const OPTIONS: QuirksResolvedOptions = {
  endpoint: 'http://minio.test:9000',
  region: 'us-east-1',
  bucket: 'vault',
  forcePathStyle: true,
  credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  maxAttempts: 3,
  requestTimeoutMs: 30_000,
}

/** A minimal successful upload result. */
function uploadResult(key: string): UploadResult {
  return {
    key,
    bucket: 'vault',
    etag: '"abc"',
    contentType: 'text/plain',
    publicUrl: 'u',
    multipart: false,
    fromIdempotencyCache: false,
  }
}

/**
 * Builds the service with a mocked main storage and a mocked scoped instance.
 *
 * @returns The service, the main upload mock, and the scoped upload mock.
 */
function setup() {
  const upload = jest.fn<StorageService['upload']>()
  const storage = { upload } as unknown as StorageService
  const scopedUpload = jest.fn<StorageService['upload']>()
  const scopedStorage = { upload: scopedUpload } as unknown as StorageService
  const scopedFactory = jest.fn<ScopedStorageFactory['storage']>().mockResolvedValue(scopedStorage)
  const scoped = { storage: scopedFactory } as unknown as ScopedStorageFactory
  const service = new QuirksService(storage, scoped, OPTIONS)
  return { service, upload, scopedUpload, scopedFactory }
}

describe('QuirksService (unit)', () => {
  it('reports divergence when WHEN_SUPPORTED is rejected but WHEN_REQUIRED succeeds', async () => {
    /*
     * Scenario: the provider rejects the SDK-default checksum but accepts the recipe mode.
     * Rule it protects: both real outcomes render side by side and divergence is flagged.
     */
    const { service, upload, scopedUpload, scopedFactory } = setup()
    scopedUpload.mockRejectedValue(new StorageException('STORAGE_PROVIDER_ERROR'))
    upload.mockImplementation((o) => Promise.resolve(uploadResult(o.key)))
    const view = await service.checksumDemo()
    expect(view.supportedMode.ok).toBe(false)
    expect(view.supportedMode.detail).toContain('STORAGE_PROVIDER_ERROR')
    expect(view.requiredMode.ok).toBe(true)
    expect(view.diverged).toBe(true)
    expect(scopedFactory.mock.calls[0]?.[1]?.requestChecksumCalculation).toBe('WHEN_SUPPORTED')
  })

  it('reports agreement when the local provider accepts both modes', async () => {
    /*
     * Scenario: a MinIO build that accepts the SDK default checksum.
     * Rule it protects: the demo does not fake a failure; it honestly reports no divergence.
     */
    const { service, upload, scopedUpload } = setup()
    scopedUpload.mockImplementation((o) => Promise.resolve(uploadResult(o.key)))
    upload.mockImplementation((o) => Promise.resolve(uploadResult(o.key)))
    const view = await service.checksumDemo()
    expect(view.supportedMode.ok).toBe(true)
    expect(view.requiredMode.ok).toBe(true)
    expect(view.diverged).toBe(false)
  })

  it('rethrows a non-StorageException from an upload attempt', async () => {
    /*
     * Scenario: an unexpected non-library error occurs during the demo.
     * Rule it protects: only StorageExceptions are captured; other errors propagate.
     */
    const { service, scopedUpload } = setup()
    scopedUpload.mockRejectedValue(new Error('socket hang up'))
    await expect(service.checksumDemo()).rejects.toThrow('socket hang up')
  })

  it('forwards a session token into the scoped WHEN_SUPPORTED instance when present', async () => {
    /*
     * Scenario: the resolved credentials carry an STS session token.
     * Rule it protects: the scoped checksum instance inherits the session token.
     */
    const upload = jest.fn<StorageService['upload']>((o) => Promise.resolve(uploadResult(o.key)))
    const storage = { upload } as unknown as StorageService
    const scopedUpload = jest.fn<StorageService['upload']>((o) =>
      Promise.resolve(uploadResult(o.key)),
    )
    const scopedStorage = { upload: scopedUpload } as unknown as StorageService
    const scopedFactory = jest
      .fn<ScopedStorageFactory['storage']>()
      .mockResolvedValue(scopedStorage)
    const scoped = { storage: scopedFactory } as unknown as ScopedStorageFactory
    const withToken: QuirksResolvedOptions = {
      ...OPTIONS,
      credentials: { accessKeyId: 'key', secretAccessKey: 'secret', sessionToken: 'sts-token' },
    }
    const service = new QuirksService(storage, scoped, withToken)
    await service.checksumDemo()
    expect(scopedFactory.mock.calls[0]?.[1]?.credentials.sessionToken).toBe('sts-token')
  })

  it('renders the ACL honesty card with the mapped error code', () => {
    /*
     * Scenario: the ACL card is requested.
     * Rule it protects: the card states the honest cross-provider behavior and alternatives.
     */
    const card = setup().service.aclGuidance()
    expect(card.mappedErrorCode).toBe('STORAGE_PROVIDER_ERROR')
    expect(card.behavior).toContain('AccessControlListNotSupported')
    expect(card.guidance.length).toBeGreaterThanOrEqual(3)
  })

  it('renders the network knobs with retries and the requestTimeoutMs caveat', () => {
    /*
     * Scenario: the network card is requested.
     * Rule it protects: retries = maxAttempts - 1 and the honest timeout caveat is stated.
     */
    const card = setup().service.networkKnobs()
    expect(card.maxAttempts).toBe(3)
    expect(card.retries).toBe(2)
    expect(card.requestTimeoutMs).toBe(30_000)
    expect(card.caveat).toContain('does not currently wire')
  })
})
