/**
 * E2E: presigned URL flows against a real MinIO (Testcontainers).
 *
 * Proves the issued URLs work for a browser-grade client using plain `fetch`:
 * a signed PUT within policy round-trips and confirm reports the honest shape
 * (size + MIME pass, but the no-op scanner reports `skipped`, so scanClean is
 * false and the object is not yet confirmed); a signed GET returns the bytes; an
 * expired GET is denied by the provider; an over-limit PUT is accepted by the
 * provider (a SigV4 PUT cannot pin a maximum size) but the mandatory confirm
 * catches the size breach; a presigned multipart completes into a downloadable
 * object; and an aborted multipart leaves no orphan parts.
 *
 * Signed URLs are credentials: this suite asserts behavior (status, bytes,
 * confirm result) and NEVER asserts a URL's contents.
 *
 * @module test/signed.e2e-spec
 */
import 'reflect-metadata'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { ListMultipartUploadsCommand, S3Client } from '@aws-sdk/client-s3'
import {
  startMinioContainer,
  MINIO_CREDENTIAL,
  type StartedMinio,
} from './helpers/minio-container.js'
import { createTestApp } from './helpers/test-app.js'

/** Size policy applied to this suite so the over-limit case uses tiny bodies. */
const MAX_SIZE_BYTES = 1024

/** Boot window covering a cold image pull plus app init. */
const BOOT_TIMEOUT_MS = 200_000

/** Issues a presigned PUT and returns its url, composed key, and headers. */
interface IssuedUpload {
  url: string
  key: string
  requiredHeaders: Record<string, string>
}

describe('signed presigned flows (e2e)', () => {
  let minio: StartedMinio
  let app: INestApplication

  beforeAll(async () => {
    minio = await startMinioContainer()
    const created = await createTestApp(minio.endpoint, {
      UPLOAD_MAX_SIZE_BYTES: String(MAX_SIZE_BYTES),
    })
    app = created.app
  }, BOOT_TIMEOUT_MS)

  afterAll(async () => {
    if (app !== undefined) {
      await app.close()
    }
    if (minio !== undefined) {
      await minio.container.stop()
    }
  })

  /** Issues an upload URL through the API. */
  async function issueUpload(contentType: string): Promise<IssuedUpload> {
    const res = await request(app.getHttpServer())
      .post('/signed/upload-url')
      .send({ category: 'attachments', contentType })
      .expect(200)
    return { url: res.body.url, key: res.body.key, requiredHeaders: res.body.requiredHeaders }
  }

  /** Issues a download URL through the API. */
  async function issueDownload(key: string, ttlSeconds?: number): Promise<string> {
    const body = ttlSeconds === undefined ? { key } : { key, ttlSeconds }
    const res = await request(app.getHttpServer())
      .post('/signed/download-url')
      .send(body)
      .expect(200)
    return res.body.url
  }

  it('PUT within policy round-trips and confirm reports the honest unscanned shape', async () => {
    /*
     * Scenario: a client PUTs a small PNG directly, then confirms it.
     * Rule it protects: the required headers make the PUT succeed; size and MIME
     * pass, but the no-op scanner reports skipped, so scanClean is false and the
     * object is NOT yet confirmed until a real scanner lands (honest trust model).
     */
    const { url, key, requiredHeaders } = await issueUpload('image/png')
    const body = new Uint8Array(64).fill(7)
    const put = await fetch(url, { method: 'PUT', headers: requiredHeaders, body })
    expect(put.ok).toBe(true)

    const confirm = await request(app.getHttpServer())
      .post('/signed/confirm')
      .send({ key })
      .expect(200)
    expect(confirm.body.scan.status).toBe('skipped')
    expect(confirm.body.checks).toEqual({
      sizeWithinPolicy: true,
      mimeAllowed: true,
      scanClean: false,
    })
    expect(confirm.body.confirmed).toBe(false)
  })

  it('GET round-trips the exact bytes that were uploaded', async () => {
    /*
     * Scenario: upload bytes, then download them through a signed GET.
     * Rule it protects: the presigned GET returns the same payload.
     */
    const { url, key, requiredHeaders } = await issueUpload('image/png')
    const payload = new Uint8Array([1, 2, 3, 4, 5])
    await fetch(url, { method: 'PUT', headers: requiredHeaders, body: payload })

    const getUrl = await issueDownload(key)
    const download = await fetch(getUrl)
    expect(download.status).toBe(200)
    const bytes = new Uint8Array(await download.arrayBuffer())
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5])
  })

  it('accepts an over-limit PUT at the provider but confirm rejects the size', async () => {
    /*
     * Scenario: a body larger than the policy is PUT directly.
     * Rule it protects: the presigned PUT cannot pin a maximum size, so the
     * provider stores it; the mandatory confirm is what catches the breach.
     */
    const { url, key, requiredHeaders } = await issueUpload('image/png')
    const oversized = new Uint8Array(MAX_SIZE_BYTES + 512).fill(9)
    const put = await fetch(url, { method: 'PUT', headers: requiredHeaders, body: oversized })
    expect(put.ok).toBe(true)

    const confirm = await request(app.getHttpServer())
      .post('/signed/confirm')
      .send({ key })
      .expect(200)
    expect(confirm.body.confirmed).toBe(false)
    expect(confirm.body.checks.sizeWithinPolicy).toBe(false)
  })

  it('denies a GET after its short TTL expires', async () => {
    /*
     * Scenario: a 1 s GET URL is used after a single bounded wait.
     * Rule it protects: the provider rejects the expired signature (403 class).
     */
    const { url, key, requiredHeaders } = await issueUpload('image/png')
    await fetch(url, { method: 'PUT', headers: requiredHeaders, body: new Uint8Array([1]) })
    const getUrl = await issueDownload(key, 1)
    await new Promise((resolve) => setTimeout(resolve, 2500))
    const expired = await fetch(getUrl)
    expect(expired.ok).toBe(false)
    expect(expired.status).toBe(403)
  })

  it('completes a presigned multipart upload into a downloadable object', async () => {
    /*
     * Scenario: presign a single-part multipart, PUT the part, then complete.
     * Rule it protects: the completeUrl assembles a downloadable object.
     */
    const issue = await request(app.getHttpServer())
      .post('/signed/multipart-urls')
      .send({ category: 'media', contentType: 'video/mp4', parts: 1 })
      .expect(200)
    const { key, partUrls, completeUrl } = issue.body
    const partUrl: string = partUrls[0].url
    const partBody = new Uint8Array([9, 8, 7, 6])
    const partPut = await fetch(partUrl, { method: 'PUT', body: partBody })
    expect(partPut.ok).toBe(true)
    const etag = partPut.headers.get('etag')
    expect(etag).not.toBeNull()

    const completeXml = `<?xml version="1.0" encoding="UTF-8"?><CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>${etag ?? ''}</ETag></Part></CompleteMultipartUpload>`
    const complete = await fetch(completeUrl, { method: 'POST', body: completeXml })
    expect(complete.ok).toBe(true)

    const getUrl = await issueDownload(key)
    const download = await fetch(getUrl)
    expect(download.status).toBe(200)
    expect(Array.from(new Uint8Array(await download.arrayBuffer()))).toEqual([9, 8, 7, 6])
  })

  it('aborts a presigned multipart upload leaving no orphan parts', async () => {
    /*
     * Scenario: presign a multipart, upload one part, then abort.
     * Rule it protects: the abort removes the in-progress upload so no orphan
     * parts remain (and are not billed).
     */
    const issue = await request(app.getHttpServer())
      .post('/signed/multipart-urls')
      .send({ category: 'media', contentType: 'video/mp4', parts: 1 })
      .expect(200)
    const { key, uploadId, partUrls } = issue.body
    await fetch(partUrls[0].url, { method: 'PUT', body: new Uint8Array([1, 2, 3]) })

    const abort = await request(app.getHttpServer())
      .post('/signed/multipart-abort')
      .send({ key, uploadId })
      .expect(200)
    expect(abort.body.aborted).toBe(true)

    const client = new S3Client({
      endpoint: minio.endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: MINIO_CREDENTIAL, secretAccessKey: MINIO_CREDENTIAL },
    })
    try {
      const listed = await client.send(new ListMultipartUploadsCommand({ Bucket: 'vault' }))
      const stillOpen = (listed.Uploads ?? []).some((upload) => upload.UploadId === uploadId)
      expect(stillOpen).toBe(false)
    } finally {
      client.destroy()
    }
  })
})
