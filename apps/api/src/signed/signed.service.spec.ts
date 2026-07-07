/**
 * Unit: SignedService - presigned GET/PUT/multipart issuance and abort.
 *
 * Mocks the library `SignedUrlService` and the raw S3 client directly. Covers:
 * download-url override pass-through and requested-vs-effective TTL clamp
 * rendering, upload-url required headers + advisory content-length range,
 * multipart issuance with expiry read from the signed URL, abort delegation
 * (success, unconfigured client, provider error, StorageException rethrow, key
 * composition guards), and the `readSignedUrlExpiry` helper.
 *
 * @module signed/signed.service.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { StorageException } from '@bymax-one/nest-storage'
import type { SignedUrlService, SignedUrlResult } from '@bymax-one/nest-storage'
import type { S3Client } from '@aws-sdk/client-s3'
import { SignedService, readSignedUrlExpiry } from './signed.service.js'
import type { StoragePolicyOptions } from './storage-policy.js'

/**
 * Builds a mock for the raw client `send`, typed with a simple signature to
 * avoid the overloaded `S3Client['send']` inference collapsing to `never`.
 *
 * @returns A jest mock resolving/rejecting an S3 command send.
 */
function makeSend() {
  return jest.fn<(command: unknown) => Promise<unknown>>()
}

/** Builds an ISO-8601 basic `X-Amz-Date` from a Date. */
function amzDate(date: Date): string {
  return `${date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')}`
}

/** Builds a presigned-URL-shaped string carrying the SigV4 expiry params. */
function fakeSignedUrl(
  expiresSeconds: number,
  signedAt = new Date('2026-07-07T10:00:00Z'),
): string {
  return `https://minio.local/vault/key?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=${amzDate(signedAt)}&X-Amz-Expires=${expiresSeconds}&X-Amz-Signature=redacted`
}

/**
 * Builds a `SignedUrlResult` stub whose URL carries the SigV4 expiry params, so
 * the service reads the effective TTL from what the library signed (as it does
 * in production) rather than from wall-clock arithmetic.
 */
function makeResult(method: 'GET' | 'PUT', ttlSeconds: number): SignedUrlResult {
  return {
    url: fakeSignedUrl(ttlSeconds),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    method,
    requiredHeaders: method === 'PUT' ? { 'Content-Type': 'image/png' } : {},
  }
}

/** Default policy options for the service under test. */
function makeOptions(overrides: Partial<StoragePolicyOptions> = {}): StoragePolicyOptions {
  return {
    bucket: 'vault',
    keyPrefix: 'storage-example',
    signedUrls: { defaultGetTtlSeconds: 300, defaultPutTtlSeconds: 300, maxTtlSeconds: 3600 },
    validation: { maxSizeBytes: 26_214_400, mimeWhitelist: ['image/png', 'video/*'] },
    ...overrides,
  }
}

/**
 * Builds the service with mocked library service and raw client.
 *
 * @param options - Policy options override.
 * @param client - The raw S3 client (or null for the unconfigured case).
 * @returns The service and its mock functions.
 */
function setup(options: StoragePolicyOptions = makeOptions(), client: S3Client | null = null) {
  const getDownloadUrl = jest.fn<SignedUrlService['getDownloadUrl']>()
  const getUploadUrl = jest.fn<SignedUrlService['getUploadUrl']>()
  const getMultipartUploadUrls = jest.fn<SignedUrlService['getMultipartUploadUrls']>()
  const signedUrls = {
    getDownloadUrl,
    getUploadUrl,
    getMultipartUploadUrls,
  } as unknown as SignedUrlService
  const service = new SignedService(signedUrls, options, client)
  return { service, getDownloadUrl, getUploadUrl, getMultipartUploadUrls }
}

describe('SignedService (unit)', () => {
  describe('createDownloadUrl', () => {
    it('passes overrides through and reports an unclamped TTL', async () => {
      /*
       * Scenario: a caller requests a 300 s GET URL with response overrides.
       * Rule it protects: the overrides reach the library and the effective TTL
       * equals the request (no clamp), never asserting the URL contents.
       */
      const { service, getDownloadUrl } = setup()
      getDownloadUrl.mockResolvedValue(makeResult('GET', 300))
      const res = await service.createDownloadUrl({
        key: 'avatars/a.png',
        ttlSeconds: 300,
        responseContentDisposition: 'attachment; filename="a.png"',
        responseContentType: 'image/png',
      })
      expect(getDownloadUrl).toHaveBeenCalledWith({
        key: 'avatars/a.png',
        ttlSeconds: 300,
        responseContentDisposition: 'attachment; filename="a.png"',
        responseContentType: 'image/png',
      })
      expect(res.method).toBe('GET')
      expect(res.requestedTtlSeconds).toBe(300)
      expect(res.effectiveTtlSeconds).toBe(300)
      expect(res.clamped).toBe(false)
      expect(res.maxTtlSeconds).toBe(3600)
      expect(typeof res.expiresAt).toBe('string')
    })

    it('renders the clamp when the request exceeds the cap and defaults the TTL when omitted', async () => {
      /*
       * Scenario: a caller requests 86400 s against a 3600 s cap and omits nothing else.
       * Rule it protects: the effective TTL (read from the signed expiry) is below
       * the request, so clamped is true; the library, not app math, decided it.
       */
      const { service, getDownloadUrl } = setup()
      getDownloadUrl.mockResolvedValue(makeResult('GET', 3600))
      const res = await service.createDownloadUrl({ key: 'avatars/a.png', ttlSeconds: 86400 })
      expect(getDownloadUrl).toHaveBeenCalledWith({ key: 'avatars/a.png', ttlSeconds: 86400 })
      expect(res.requestedTtlSeconds).toBe(86400)
      expect(res.effectiveTtlSeconds).toBe(3600)
      expect(res.clamped).toBe(true)
    })

    it('reports the configured default when ttlSeconds is omitted', async () => {
      /*
       * Scenario: a caller omits ttlSeconds entirely.
       * Rule it protects: requestedTtlSeconds falls back to the configured default.
       */
      const { service, getDownloadUrl } = setup()
      getDownloadUrl.mockResolvedValue(makeResult('GET', 300))
      const res = await service.createDownloadUrl({ key: 'avatars/a.png' })
      expect(getDownloadUrl).toHaveBeenCalledWith({ key: 'avatars/a.png' })
      expect(res.requestedTtlSeconds).toBe(300)
    })

    it('propagates the library TTL-invalid rejection', async () => {
      /*
       * Scenario: a non-positive TTL reaches the library.
       * Rule it protects: the STORAGE_SIGNED_URL_TTL_INVALID envelope is not
       * hand-rolled; the service lets the library exception propagate.
       */
      const { service, getDownloadUrl } = setup()
      getDownloadUrl.mockRejectedValue(new StorageException('STORAGE_SIGNED_URL_TTL_INVALID'))
      await expect(
        service.createDownloadUrl({ key: 'avatars/a.png', ttlSeconds: 0 }),
      ).rejects.toBeInstanceOf(StorageException)
    })
  })

  describe('createUploadUrl', () => {
    it('composes a key, echoes required headers, and caps the range by policy', async () => {
      /*
       * Scenario: a caller requests a PUT URL with a maxSizeBytes above the policy.
       * Rule it protects: the advisory range is the lower of request and policy,
       * and the mandatory confirm step is stated in the note.
       */
      const { service, getUploadUrl } = setup()
      getUploadUrl.mockResolvedValue(makeResult('PUT', 300))
      const res = await service.createUploadUrl({
        category: 'avatars',
        contentType: 'image/png',
        maxSizeBytes: 99_000_000,
      })
      expect(res.method).toBe('PUT')
      expect(res.key).toMatch(/^avatars\/[0-9a-f-]{36}$/)
      expect(res.requiredHeaders).toEqual({ 'Content-Type': 'image/png' })
      expect(res.contentLengthRange).toEqual({ minBytes: 0, maxBytes: 26_214_400 })
      expect(res.note).toContain('confirm')
      const call = getUploadUrl.mock.calls[0]?.[0]
      expect(call?.contentType).toBe('image/png')
      expect(call?.maxSizeBytes).toBe(99_000_000)
    })

    it('uses the requested cap when it is below the policy and forwards ttlSeconds', async () => {
      /*
       * Scenario: a caller requests a small maxSizeBytes and an explicit TTL.
       * Rule it protects: the smaller requested cap wins and ttlSeconds is forwarded.
       */
      const { service, getUploadUrl } = setup()
      getUploadUrl.mockResolvedValue(makeResult('PUT', 120))
      const res = await service.createUploadUrl({
        category: 'invoices',
        contentType: 'application/pdf',
        maxSizeBytes: 1024,
        ttlSeconds: 120,
      })
      expect(res.contentLengthRange).toEqual({ minBytes: 0, maxBytes: 1024 })
      expect(getUploadUrl.mock.calls[0]?.[0].ttlSeconds).toBe(120)
    })

    it('omits maxBytes when neither request nor policy sets a size cap', async () => {
      /*
       * Scenario: no requested cap and a policy without maxSizeBytes.
       * Rule it protects: the advisory range degrades to a lower bound only.
       */
      const { service, getUploadUrl } = setup(
        makeOptions({ validation: { mimeWhitelist: ['image/png'] } }),
      )
      getUploadUrl.mockResolvedValue(makeResult('PUT', 300))
      const res = await service.createUploadUrl({ category: 'media', contentType: 'image/png' })
      expect(res.contentLengthRange).toEqual({ minBytes: 0 })
    })
  })

  describe('createMultipartUrls', () => {
    it('returns part URLs and reads the effective expiry from the signed complete URL', async () => {
      /*
       * Scenario: a 3-part multipart is presigned with a clamped 3600 s TTL.
       * Rule it protects: expiresAt/effectiveTtl come from the signed URL, not
       * from recomputing the clamp, and the 5 MiB minimum is documented.
       */
      const { service, getMultipartUploadUrls } = setup()
      getMultipartUploadUrls.mockResolvedValue({
        uploadId: 'UP-1',
        partUrls: [
          { partNumber: 1, url: fakeSignedUrl(3600) },
          { partNumber: 2, url: fakeSignedUrl(3600) },
          { partNumber: 3, url: fakeSignedUrl(3600) },
        ],
        completeUrl: fakeSignedUrl(3600),
      })
      const res = await service.createMultipartUrls({
        category: 'media',
        contentType: 'video/mp4',
        parts: 3,
        ttlSeconds: 86400,
      })
      expect(res.uploadId).toBe('UP-1')
      expect(res.partUrls).toHaveLength(3)
      expect(res.parts).toBe(3)
      expect(res.effectiveTtlSeconds).toBe(3600)
      expect(res.minPartSizeBytes).toBe(5 * 1024 * 1024)
      expect(res.expiresAt).toBe(new Date('2026-07-07T11:00:00Z').toISOString())
      expect(getMultipartUploadUrls.mock.calls[0]?.[0].ttlSeconds).toBe(86400)
    })

    it('omits ttlSeconds from the library call when not requested', async () => {
      /*
       * Scenario: a caller omits ttlSeconds for the multipart request.
       * Rule it protects: no undefined ttlSeconds is forwarded (exactOptionalPropertyTypes).
       */
      const { service, getMultipartUploadUrls } = setup()
      getMultipartUploadUrls.mockResolvedValue({
        uploadId: 'UP-2',
        partUrls: [{ partNumber: 1, url: fakeSignedUrl(300) }],
        completeUrl: fakeSignedUrl(300),
      })
      await service.createMultipartUrls({ category: 'media', contentType: 'video/mp4', parts: 1 })
      expect(getMultipartUploadUrls.mock.calls[0]?.[0]).not.toHaveProperty('ttlSeconds')
    })
  })

  describe('abortMultipart', () => {
    it('throws STORAGE_NOT_CONFIGURED when no client is available', async () => {
      /*
       * Scenario: abort is called while the module has no configured client.
       * Rule it protects: the raw-client path surfaces the not-configured envelope.
       */
      const { service } = setup(makeOptions(), null)
      await expect(
        service.abortMultipart({ key: 'media/x', uploadId: 'UP' }),
      ).rejects.toMatchObject({
        code: 'STORAGE_NOT_CONFIGURED',
      })
    })

    it('sends AbortMultipartUpload with the prefixed key and collapses slashes', async () => {
      /*
       * Scenario: abort a real in-progress upload.
       * Rule it protects: the key is prefixed like the library signed it and
       * duplicate slashes are collapsed.
       */
      const send = makeSend().mockResolvedValue(undefined)
      const client = { send } as unknown as S3Client
      const { service } = setup(makeOptions(), client)
      const res = await service.abortMultipart({ key: 'media//clip.mp4', uploadId: 'UP-9' })
      expect(res).toMatchObject({ aborted: true, key: 'media//clip.mp4', uploadId: 'UP-9' })
      const command = send.mock.calls[0]?.[0] as {
        input: { Key: string; Bucket: string; UploadId: string }
      }
      expect(command.input).toMatchObject({
        Key: 'storage-example/media/clip.mp4',
        Bucket: 'vault',
        UploadId: 'UP-9',
      })
    })

    it('composes the key without a prefix when none is configured', async () => {
      /*
       * Scenario: the module runs with an empty keyPrefix.
       * Rule it protects: the abort key is the raw key with no leading prefix.
       */
      const send = makeSend().mockResolvedValue(undefined)
      const client = { send } as unknown as S3Client
      const { service } = setup(makeOptions({ keyPrefix: '' }), client)
      await service.abortMultipart({ key: 'media/x.mp4', uploadId: 'UP' })
      const command = send.mock.calls[0]?.[0] as { input: { Key: string } }
      expect(command.input.Key).toBe('media/x.mp4')
    })

    it('rejects a traversal key with STORAGE_KEY_INVALID', async () => {
      /*
       * Scenario: an abort key contains a ".." segment.
       * Rule it protects: the same traversal guard the library applies is enforced
       * before composing the raw-client key.
       */
      const send = makeSend()
      const client = { send } as unknown as S3Client
      const { service } = setup(makeOptions(), client)
      await expect(
        service.abortMultipart({ key: 'media/../secret', uploadId: 'UP' }),
      ).rejects.toMatchObject({ code: 'STORAGE_KEY_INVALID' })
      await expect(service.abortMultipart({ key: '/abs', uploadId: 'UP' })).rejects.toMatchObject({
        code: 'STORAGE_KEY_INVALID',
      })
      expect(send).not.toHaveBeenCalled()
    })

    it('maps a raw provider error to STORAGE_PROVIDER_ERROR', async () => {
      /*
       * Scenario: the raw AbortMultipartUpload call throws a non-library error.
       * Rule it protects: the AWS error is wrapped in the envelope contract and
       * never leaks a raw stack.
       */
      const send = makeSend().mockRejectedValue(new Error('network down'))
      const client = { send } as unknown as S3Client
      const { service } = setup(makeOptions(), client)
      await expect(
        service.abortMultipart({ key: 'media/x', uploadId: 'UP' }),
      ).rejects.toMatchObject({
        code: 'STORAGE_PROVIDER_ERROR',
      })
    })

    it('rethrows a StorageException from the raw client unchanged', async () => {
      /*
       * Scenario: the raw client throws a StorageException.
       * Rule it protects: an already-typed library error is not re-wrapped.
       */
      const send = makeSend().mockRejectedValue(new StorageException('STORAGE_TIMEOUT'))
      const client = { send } as unknown as S3Client
      const { service } = setup(makeOptions(), client)
      await expect(
        service.abortMultipart({ key: 'media/x', uploadId: 'UP' }),
      ).rejects.toMatchObject({
        code: 'STORAGE_TIMEOUT',
      })
    })
  })

  describe('readSignedUrlExpiry', () => {
    it('reads the effective TTL and absolute expiry from the SigV4 params', () => {
      /*
       * Scenario: a well-formed presigned URL is parsed.
       * Rule it protects: expiry is derived from X-Amz-Date + X-Amz-Expires.
       */
      const { expiresAt, effectiveTtlSeconds } = readSignedUrlExpiry(fakeSignedUrl(1800))
      expect(effectiveTtlSeconds).toBe(1800)
      expect(expiresAt.toISOString()).toBe(new Date('2026-07-07T10:30:00Z').toISOString())
    })

    it('throws STORAGE_PROVIDER_ERROR when the SigV4 params are missing', () => {
      /*
       * Scenario: a URL without the expiry query parameters.
       * Rule it protects: a contract violation surfaces the provider-error envelope.
       */
      expect(() => readSignedUrlExpiry('https://minio.local/vault/key')).toThrow(StorageException)
    })

    it('throws when the X-Amz-Date is present but unparseable', () => {
      /*
       * Scenario: the date param does not match the SigV4 basic format.
       * Rule it protects: a malformed signing time surfaces the provider error
       * rather than producing an Invalid Date.
       */
      const url = 'https://minio.local/vault/key?X-Amz-Date=notadate&X-Amz-Expires=300'
      expect(() => readSignedUrlExpiry(url)).toThrow(StorageException)
    })

    it('throws when the X-Amz-Expires is present but non-numeric', () => {
      /*
       * Scenario: the expires param is not a number.
       * Rule it protects: a malformed lifetime surfaces the provider error.
       */
      const url = 'https://minio.local/vault/key?X-Amz-Date=20260707T100000Z&X-Amz-Expires=abc'
      expect(() => readSignedUrlExpiry(url)).toThrow(StorageException)
    })
  })
})
