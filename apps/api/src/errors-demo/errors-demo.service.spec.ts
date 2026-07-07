/**
 * Unit: ErrorsDemoService - drives the deterministic trigger registry.
 *
 * Mocks the running facades and the scoped-storage factory, then invokes every
 * shipped error code: reproducible codes reject with their real StorageException
 * (asserting the crafted input or scoped-instance options that reproduce them),
 * STORAGE_INVALID_CONFIG runs the real synchronous forRoot({}) probe, and the one
 * non-reproducible code resolves to an honest outcome. Also covers catalogue().
 *
 * @module errors-demo/errors-demo.service.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { StorageException } from '@bymax-one/nest-storage'
import type { SignedUrlService, StorageService } from '@bymax-one/nest-storage'
import { ErrorsDemoService, type ErrorsConnectionOptions } from './errors-demo.service.js'
import type { ScopedStorageFactory } from '../common/scoped-storage.factory.js'

/** Connection facts injected as the resolved options view. */
const CONNECTION: ErrorsConnectionOptions = {
  endpoint: 'http://minio.test:9000',
  region: 'us-east-1',
  bucket: 'vault',
}

/**
 * Builds the service with mocked facades and a mocked scoped factory whose
 * instances reject as configured per test.
 *
 * @returns The service and the mocked collaborators.
 */
function setup() {
  const upload = jest.fn<StorageService['upload']>()
  const head = jest.fn<StorageService['head']>()
  const storage = { upload, head } as unknown as StorageService
  const getDownloadUrl = jest.fn<SignedUrlService['getDownloadUrl']>()
  const getMultipartUploadUrls = jest.fn<SignedUrlService['getMultipartUploadUrls']>()
  const signedUrls = { getDownloadUrl, getMultipartUploadUrls } as unknown as SignedUrlService
  const scopedUpload = jest.fn<StorageService['upload']>()
  const scopedHead = jest.fn<StorageService['head']>()
  const scopedStorage = { upload: scopedUpload, head: scopedHead } as unknown as StorageService
  const scopedFactory = jest.fn<ScopedStorageFactory['storage']>().mockResolvedValue(scopedStorage)
  const scoped = { storage: scopedFactory } as unknown as ScopedStorageFactory
  const service = new ErrorsDemoService(storage, signedUrls, scoped, CONNECTION)
  return {
    service,
    upload,
    head,
    getDownloadUrl,
    getMultipartUploadUrls,
    scopedFactory,
    scopedUpload,
    scopedHead,
  }
}

describe('ErrorsDemoService (unit)', () => {
  it('renders the catalogue via buildCatalogue', () => {
    /*
     * Scenario: the catalogue endpoint is queried.
     * Rule it protects: the service exposes the exhaustive catalogue.
     */
    expect(setup().service.catalogue().length).toBeGreaterThanOrEqual(18)
  })

  it('triggers STORAGE_KEY_INVALID with a traversal key on the main module', async () => {
    /*
     * Scenario: the key-invalid code is requested.
     * Rule it protects: the trigger uploads a `..` traversal key and propagates the envelope.
     */
    const { service, upload } = setup()
    upload.mockRejectedValue(new StorageException('STORAGE_KEY_INVALID'))
    await expect(service.trigger('STORAGE_KEY_INVALID')).rejects.toMatchObject({
      code: 'STORAGE_KEY_INVALID',
    })
    expect(upload.mock.calls[0]?.[0]?.key).toBe('errors-demo/../escape')
  })

  it('triggers STORAGE_BODY_MISSING with a bodyless upload', async () => {
    /*
     * Scenario: the body-missing code is requested.
     * Rule it protects: the upload options carry no body.
     */
    const { service, upload } = setup()
    upload.mockRejectedValue(new StorageException('STORAGE_BODY_MISSING'))
    await expect(service.trigger('STORAGE_BODY_MISSING')).rejects.toMatchObject({
      code: 'STORAGE_BODY_MISSING',
    })
    expect(upload.mock.calls[0]?.[0]?.body).toBeUndefined()
  })

  it('triggers STORAGE_CONTENT_TYPE_REQUIRED with an empty content type', async () => {
    /*
     * Scenario: the content-type-required code is requested.
     * Rule it protects: the upload declares an empty content type.
     */
    const { service, upload } = setup()
    upload.mockRejectedValue(new StorageException('STORAGE_CONTENT_TYPE_REQUIRED'))
    await expect(service.trigger('STORAGE_CONTENT_TYPE_REQUIRED')).rejects.toMatchObject({
      code: 'STORAGE_CONTENT_TYPE_REQUIRED',
    })
    expect(upload.mock.calls[0]?.[0]?.contentType).toBe('')
  })

  it('triggers STORAGE_MIME_NOT_ALLOWED with a disallowed content type', async () => {
    /*
     * Scenario: the MIME-not-allowed code is requested.
     * Rule it protects: the upload declares application/zip against the whitelist.
     */
    const { service, upload } = setup()
    upload.mockRejectedValue(new StorageException('STORAGE_MIME_NOT_ALLOWED'))
    await expect(service.trigger('STORAGE_MIME_NOT_ALLOWED')).rejects.toMatchObject({
      code: 'STORAGE_MIME_NOT_ALLOWED',
    })
    expect(upload.mock.calls[0]?.[0]?.contentType).toBe('application/zip')
  })

  it('triggers STORAGE_SIZE_EXCEEDED with an oversized declared size', async () => {
    /*
     * Scenario: the size-exceeded code is requested.
     * Rule it protects: the declared size exceeds any configured cap.
     */
    const { service, upload } = setup()
    upload.mockRejectedValue(new StorageException('STORAGE_SIZE_EXCEEDED'))
    await expect(service.trigger('STORAGE_SIZE_EXCEEDED')).rejects.toMatchObject({
      code: 'STORAGE_SIZE_EXCEEDED',
    })
    expect(upload.mock.calls[0]?.[0]?.size).toBeGreaterThan(1_000_000_000)
  })

  it('triggers STORAGE_VALIDATION_FAILED with a forged PDF body', async () => {
    /*
     * Scenario: the validation-failed code is requested.
     * Rule it protects: the body is declared PDF without the magic bytes.
     */
    const { service, upload } = setup()
    upload.mockRejectedValue(new StorageException('STORAGE_VALIDATION_FAILED'))
    await expect(service.trigger('STORAGE_VALIDATION_FAILED')).rejects.toMatchObject({
      code: 'STORAGE_VALIDATION_FAILED',
    })
    expect(upload.mock.calls[0]?.[0]?.contentType).toBe('application/pdf')
  })

  it('triggers STORAGE_SCAN_INFECTED with the inert infected marker', async () => {
    /*
     * Scenario: the scan-infected code is requested.
     * Rule it protects: the body carries the inert X-DEMO-INFECTED marker.
     */
    const { service, upload } = setup()
    upload.mockRejectedValue(new StorageException('STORAGE_SCAN_INFECTED'))
    await expect(service.trigger('STORAGE_SCAN_INFECTED')).rejects.toMatchObject({
      code: 'STORAGE_SCAN_INFECTED',
    })
    const body = upload.mock.calls[0]?.[0]?.body as Buffer
    expect(body.toString('utf8')).toContain('X-DEMO-INFECTED')
  })

  it('triggers STORAGE_OBJECT_NOT_FOUND with a head on a missing key', async () => {
    /*
     * Scenario: the not-found code is requested.
     * Rule it protects: a head() probes a nonexistent key.
     */
    const { service, head } = setup()
    head.mockRejectedValue(new StorageException('STORAGE_OBJECT_NOT_FOUND'))
    await expect(service.trigger('STORAGE_OBJECT_NOT_FOUND')).rejects.toMatchObject({
      code: 'STORAGE_OBJECT_NOT_FOUND',
    })
    expect(head.mock.calls[0]?.[0]).toMatch(/^errors-demo\/missing-/)
  })

  it('triggers STORAGE_BUCKET_UNDEFINED with an empty per-call bucket', async () => {
    /*
     * Scenario: the bucket-undefined code is requested.
     * Rule it protects: the head() override passes an empty bucket.
     */
    const { service, head } = setup()
    head.mockRejectedValue(new StorageException('STORAGE_BUCKET_UNDEFINED'))
    await expect(service.trigger('STORAGE_BUCKET_UNDEFINED')).rejects.toMatchObject({
      code: 'STORAGE_BUCKET_UNDEFINED',
    })
    expect(head.mock.calls[0]?.[1]).toEqual({ bucket: '' })
  })

  it('triggers STORAGE_SIGNED_URL_TTL_INVALID with a zero TTL', async () => {
    /*
     * Scenario: the invalid-TTL code is requested.
     * Rule it protects: the signed download URL requests ttlSeconds 0.
     */
    const { service, getDownloadUrl } = setup()
    getDownloadUrl.mockRejectedValue(new StorageException('STORAGE_SIGNED_URL_TTL_INVALID'))
    await expect(service.trigger('STORAGE_SIGNED_URL_TTL_INVALID')).rejects.toMatchObject({
      code: 'STORAGE_SIGNED_URL_TTL_INVALID',
    })
    expect(getDownloadUrl.mock.calls[0]?.[0]?.ttlSeconds).toBe(0)
  })

  it('triggers STORAGE_INVALID_PART_COUNT with zero parts', async () => {
    /*
     * Scenario: the invalid-part-count code is requested.
     * Rule it protects: the multipart presign requests parts 0.
     */
    const { service, getMultipartUploadUrls } = setup()
    getMultipartUploadUrls.mockRejectedValue(new StorageException('STORAGE_INVALID_PART_COUNT'))
    await expect(service.trigger('STORAGE_INVALID_PART_COUNT')).rejects.toMatchObject({
      code: 'STORAGE_INVALID_PART_COUNT',
    })
    expect(getMultipartUploadUrls.mock.calls[0]?.[0]?.parts).toBe(0)
  })

  it('triggers STORAGE_NOT_CONFIGURED via an unconfigured scoped instance', async () => {
    /*
     * Scenario: the not-configured code is requested.
     * Rule it protects: a scoped instance is built with empty credentials.
     */
    const { service, scopedFactory, scopedHead } = setup()
    scopedHead.mockRejectedValue(new StorageException('STORAGE_NOT_CONFIGURED'))
    await expect(service.trigger('STORAGE_NOT_CONFIGURED')).rejects.toMatchObject({
      code: 'STORAGE_NOT_CONFIGURED',
    })
    expect(scopedFactory.mock.calls[0]?.[0]).toBe('unconfigured')
    expect(scopedFactory.mock.calls[0]?.[1]?.credentials).toEqual({
      accessKeyId: '',
      secretAccessKey: '',
    })
  })

  it('triggers STORAGE_PROVIDER_ERROR via a wrong-credentials scoped instance', async () => {
    /*
     * Scenario: the provider-error code is requested.
     * Rule it protects: a scoped instance uses wrong credentials against the real endpoint.
     */
    const { service, scopedFactory, scopedHead } = setup()
    scopedHead.mockRejectedValue(new StorageException('STORAGE_PROVIDER_ERROR'))
    await expect(service.trigger('STORAGE_PROVIDER_ERROR')).rejects.toMatchObject({
      code: 'STORAGE_PROVIDER_ERROR',
    })
    expect(scopedFactory.mock.calls[0]?.[0]).toBe('wrong-credentials')
    expect(scopedFactory.mock.calls[0]?.[1]?.endpoint).toBe(CONNECTION.endpoint)
  })

  it('returns an honest outcome for the non-reproducible STORAGE_TIMEOUT', async () => {
    /*
     * Scenario: the timeout code is requested.
     * Rule it protects: requestTimeoutMs is not wired into the shipped client, so no
     * StorageException is fabricated; an explanatory outcome returns instead.
     */
    const outcome = await setup().service.trigger('STORAGE_TIMEOUT')
    expect(outcome).toMatchObject({ code: 'STORAGE_TIMEOUT', reproducible: false })
  })

  it('triggers STORAGE_MULTIPART_ABORTED via a forced-multipart scoped upload', async () => {
    /*
     * Scenario: the multipart-aborted code is requested.
     * Rule it protects: a wrong-credentials instance is forced onto the multipart path.
     */
    const { service, scopedFactory, scopedUpload } = setup()
    scopedUpload.mockRejectedValue(new StorageException('STORAGE_MULTIPART_ABORTED'))
    await expect(service.trigger('STORAGE_MULTIPART_ABORTED')).rejects.toMatchObject({
      code: 'STORAGE_MULTIPART_ABORTED',
    })
    expect(scopedFactory.mock.calls[0]?.[0]).toBe('wrong-credentials')
    expect(scopedUpload.mock.calls[0]?.[0]?.size).toBeUndefined()
  })

  it('triggers STORAGE_SCAN_INCONCLUSIVE via a reject-unknown scoped instance', async () => {
    /*
     * Scenario: the scan-inconclusive code is requested.
     * Rule it protects: a scoped instance rejects an unknown verdict on the X-DEMO-UNKNOWN body.
     */
    const { service, scopedFactory, scopedUpload } = setup()
    scopedUpload.mockRejectedValue(new StorageException('STORAGE_SCAN_INCONCLUSIVE'))
    await expect(service.trigger('STORAGE_SCAN_INCONCLUSIVE')).rejects.toMatchObject({
      code: 'STORAGE_SCAN_INCONCLUSIVE',
    })
    expect(scopedFactory.mock.calls[0]?.[0]).toBe('reject-unknown')
    expect(scopedFactory.mock.calls[0]?.[1]?.scanner?.rejectOnUnknown).toBe(true)
  })

  it('triggers STORAGE_INVALID_CONFIG via the real synchronous forRoot probe', async () => {
    /*
     * Scenario: the invalid-config code is requested.
     * Rule it protects: forRoot({}) really throws STORAGE_INVALID_CONFIG (no mock).
     */
    await expect(setup().service.trigger('STORAGE_INVALID_CONFIG')).rejects.toMatchObject({
      code: 'STORAGE_INVALID_CONFIG',
    })
  })

  it('returns an honest outcome for the non-reproducible STORAGE_PART_TOO_SMALL', async () => {
    /*
     * Scenario: the defined-but-unthrown code is requested.
     * Rule it protects: no StorageException is fabricated; an explanatory outcome returns.
     */
    const outcome = await setup().service.trigger('STORAGE_PART_TOO_SMALL')
    expect(outcome).toEqual({
      code: 'STORAGE_PART_TOO_SMALL',
      reproducible: false,
      note: expect.stringContaining('no code path'),
    })
  })
})
