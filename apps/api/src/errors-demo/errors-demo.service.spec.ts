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
// Direct value import so the mutation runner maps this spec as a related test of
// the trigger registry (the service reaches it only transitively, which the
// jest test-selection heuristic does not follow).
import { buildTriggerRegistry } from './trigger.registry.js'
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

  describe('buildTriggerRegistry (direct)', () => {
    /** Builds the registry directly over mocked collaborators, exposing the mocks. */
    function buildDirect() {
      const upload = jest.fn<StorageService['upload']>()
      const head = jest.fn<StorageService['head']>()
      const storage = { upload, head } as unknown as StorageService
      const getDownloadUrl = jest.fn<SignedUrlService['getDownloadUrl']>()
      const getMultipartUploadUrls = jest.fn<SignedUrlService['getMultipartUploadUrls']>()
      const signedUrls = { getDownloadUrl, getMultipartUploadUrls } as unknown as SignedUrlService
      const scopedUploadFn = jest.fn<StorageService['upload']>()
      const scopedHeadFn = jest.fn<StorageService['head']>()
      const scopedInstance = {
        head: scopedHeadFn,
        upload: scopedUploadFn,
      } as unknown as StorageService
      const storageFactory = jest
        .fn<ScopedStorageFactory['storage']>()
        .mockResolvedValue(scopedInstance)
      const scoped = { storage: storageFactory } as unknown as ScopedStorageFactory
      const registry = buildTriggerRegistry({ storage, signedUrls, scoped, connection: CONNECTION })
      return {
        registry,
        storageFactory,
        upload,
        head,
        getDownloadUrl,
        getMultipartUploadUrls,
        scopedUploadFn,
        scopedHeadFn,
      }
    }

    it('maps a trigger for every shipped error code', () => {
      /*
       * Scenario: the registry is built directly from mocked collaborators.
       * Rule it protects: every shipped code resolves to a callable trigger, so no
       * code is left without a deterministic reproduction path.
       */
      const { registry } = buildDirect()
      expect(Object.keys(registry).length).toBeGreaterThanOrEqual(18)
      expect(Object.values(registry).every((trigger) => typeof trigger === 'function')).toBe(true)
    })

    it('drives each guard and pipeline trigger with its exact crafted input', async () => {
      /*
       * Scenario: every crafted-input trigger runs against the mocked module.
       * Rule it protects: each trigger passes the precise key, content type, size
       * and body that reproduces its code, so blanking any crafted literal is
       * caught.
       */
      const d = buildDirect()
      await d.registry.STORAGE_KEY_INVALID().catch(() => undefined)
      await d.registry.STORAGE_BODY_MISSING().catch(() => undefined)
      await d.registry.STORAGE_CONTENT_TYPE_REQUIRED().catch(() => undefined)
      await d.registry.STORAGE_MIME_NOT_ALLOWED().catch(() => undefined)
      await d.registry.STORAGE_SIZE_EXCEEDED().catch(() => undefined)
      await d.registry.STORAGE_VALIDATION_FAILED().catch(() => undefined)
      await d.registry.STORAGE_SCAN_INFECTED().catch(() => undefined)
      const uploads = d.upload.mock.calls.map((call) => call[0])
      expect(uploads[0]).toMatchObject({ key: 'errors-demo/../escape', contentType: 'text/plain' })
      // The filler bodies are a non-empty single byte 'x'; blanking them is caught.
      expect((uploads[0]?.body as Buffer).toString('utf8')).toBe('x')
      expect(uploads[1]).toMatchObject({ key: 'errors-demo/no-body' })
      expect(uploads[1]?.body).toBeUndefined()
      expect(uploads[2]).toMatchObject({ key: 'errors-demo/no-content-type', contentType: '' })
      expect((uploads[2]?.body as Buffer).toString('utf8')).toBe('x')
      expect(uploads[3]).toMatchObject({
        key: 'errors-demo/disallowed',
        contentType: 'application/zip',
      })
      expect((uploads[3]?.body as Buffer).toString('utf8')).toBe('x')
      expect(uploads[4]).toMatchObject({
        key: 'errors-demo/too-large.png',
        contentType: 'image/png',
      })
      expect((uploads[4]?.body as Buffer).toString('utf8')).toBe('x')
      expect(uploads[4]?.size).toBe(1_099_511_627_776)
      expect(uploads[5]).toMatchObject({
        key: 'errors-demo/forged.pdf',
        contentType: 'application/pdf',
      })
      expect((uploads[5]?.body as Buffer).toString('utf8')).toBe('this is not a pdf')
      expect(uploads[6]).toMatchObject({
        key: 'errors-demo/infected.png',
        contentType: 'image/png',
      })
      expect((uploads[6]?.body as Buffer).toString('utf8')).toBe('X-DEMO-INFECTED sample payload')
    })

    it('drives the head, signed and multipart triggers with their exact crafted input', async () => {
      /*
       * Scenario: the head-based, signed-URL and forced-multipart triggers run.
       * Rule it protects: each passes its precise key, bucket override, TTL, part
       * count, content type and stream body that reproduces its code.
       */
      const d = buildDirect()
      await d.registry.STORAGE_OBJECT_NOT_FOUND().catch(() => undefined)
      await d.registry.STORAGE_BUCKET_UNDEFINED().catch(() => undefined)
      await d.registry.STORAGE_SIGNED_URL_TTL_INVALID().catch(() => undefined)
      await d.registry.STORAGE_INVALID_PART_COUNT().catch(() => undefined)
      await d.registry.STORAGE_MULTIPART_ABORTED().catch(() => undefined)
      await d.registry.STORAGE_SCAN_INCONCLUSIVE().catch(() => undefined)
      expect(d.head.mock.calls[0]?.[0]).toMatch(/^errors-demo\/missing-/)
      expect(d.head.mock.calls[1]?.[0]).toBe('errors-demo/bucket')
      expect(d.head.mock.calls[1]?.[1]).toEqual({ bucket: '' })
      expect(d.getDownloadUrl.mock.calls[0]?.[0]).toEqual({
        key: 'errors-demo/ttl',
        ttlSeconds: 0,
      })
      expect(d.getMultipartUploadUrls.mock.calls[0]?.[0]).toEqual({
        key: 'errors-demo/parts',
        contentType: 'text/plain',
        parts: 0,
      })
      const multipartUpload = d.scopedUploadFn.mock.calls[0]?.[0]
      expect(multipartUpload?.key).toBe('errors-demo/multipart')
      expect(multipartUpload?.contentType).toBe('text/plain')
      // The forced-multipart body is a stream carrying exactly one 'chunk'; a mutant
      // that empties the chunk array or blanks the chunk string yields a different body.
      const streamChunks: Buffer[] = []
      for await (const part of multipartUpload?.body as AsyncIterable<Buffer | string>) {
        streamChunks.push(typeof part === 'string' ? Buffer.from(part) : part)
      }
      expect(Buffer.concat(streamChunks).toString('utf8')).toBe('chunk')
      const scanUpload = d.scopedUploadFn.mock.calls[1]?.[0]
      expect(scanUpload?.key).toBe('errors-demo/unknown.txt')
      expect(scanUpload?.contentType).toBe('text/plain')
      expect((scanUpload?.body as Buffer).toString('utf8')).toBe('X-DEMO-UNKNOWN sample payload')
    })

    it('builds the unconfigured scoped instance with path-style addressing and empty credentials', async () => {
      /*
       * Scenario: the not-configured trigger runs.
       * Rule it protects: the scoped options force path-style addressing and carry
       * blank credentials so the instance asserts unconfigured before any request.
       */
      const { registry, storageFactory, scopedHeadFn } = buildDirect()
      await registry.STORAGE_NOT_CONFIGURED().catch(() => undefined)
      const options = storageFactory.mock.calls[0]?.[1]
      expect(options?.forcePathStyle).toBe(true)
      expect(options?.credentials).toEqual({ accessKeyId: '', secretAccessKey: '' })
      // The unconfigured instance is probed with a fixed key; blanking it is caught.
      expect(scopedHeadFn.mock.calls[0]?.[0]).toBe('errors-demo/probe')
    })

    it('builds the wrong-credentials scoped instance with a single attempt and path style', async () => {
      /*
       * Scenario: the provider-error trigger runs.
       * Rule it protects: the scoped options cap retries at one attempt and force
       * path-style addressing so the 403 surfaces promptly.
       */
      const { registry, storageFactory, scopedHeadFn } = buildDirect()
      await registry.STORAGE_PROVIDER_ERROR().catch(() => undefined)
      const options = storageFactory.mock.calls[0]?.[1]
      expect(options?.forcePathStyle).toBe(true)
      expect(options?.maxAttempts).toBe(1)
      // The wrong-credentials instance is probed with a fixed key; blanking it is caught.
      expect(scopedHeadFn.mock.calls[0]?.[0]).toBe('errors-demo/probe')
      expect(options?.credentials).toEqual({
        accessKeyId: 'wrong-access-key',
        secretAccessKey: 'wrong-secret-key',
      })
    })

    it('builds the reject-unknown scoped instance with a pre-upload scanner that rejects unknowns', async () => {
      /*
       * Scenario: the scan-inconclusive trigger runs.
       * Rule it protects: the scoped scanner runs pre-upload and rejects an unknown
       * verdict with path-style addressing.
       */
      const { registry, storageFactory } = buildDirect()
      await registry.STORAGE_SCAN_INCONCLUSIVE().catch(() => undefined)
      const options = storageFactory.mock.calls[0]?.[1]
      expect(options?.forcePathStyle).toBe(true)
      expect(options?.scanner?.mode).toBe('pre-upload')
      expect(options?.scanner?.rejectOnUnknown).toBe(true)
      expect(options?.credentials).toEqual({
        accessKeyId: 'scan-only',
        secretAccessKey: 'scan-only',
      })
    })

    it('returns the exact honest note for the non-reproducible codes', async () => {
      /*
       * Scenario: the two defined-but-unthrown codes are triggered directly.
       * Rule it protects: both resolve to the exact explanatory note rather than a
       * fabricated exception.
       */
      const { registry } = buildDirect()
      const note =
        'This code is defined in STORAGE_ERROR_CODES but the shipped library has no code path that throws it. See GET /errors for the reconciled explanation.'
      expect(await registry.STORAGE_PART_TOO_SMALL()).toEqual({
        code: 'STORAGE_PART_TOO_SMALL',
        reproducible: false,
        note,
      })
      expect(await registry.STORAGE_TIMEOUT()).toEqual({
        code: 'STORAGE_TIMEOUT',
        reproducible: false,
        note,
      })
    })
  })
})
