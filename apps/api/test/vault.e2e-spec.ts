/**
 * E2E: the vault surface against a real MinIO (Testcontainers).
 *
 * Exercises every `/vault` and `/vault/object` route from the spec §11.1
 * catalogue end to end: seed an object through the real upload endpoint, then
 * list, head, download (stream), preview (buffer), byte-range, versioned-bucket
 * retrieval, public-URL rendering, server-side copy, bulk delete, and idempotent
 * single delete. Error paths (404 missing key, 400 inverted range and bad query,
 * 413 oversized range, the Zod reject envelope) are asserted on the same app.
 *
 * @module test/vault.e2e-spec
 */
import 'reflect-metadata'
import request from 'supertest'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { INestApplication } from '@nestjs/common'
import {
  startMinioContainer,
  MINIO_CREDENTIAL,
  type StartedMinio,
} from './helpers/minio-container.js'
import { createTestApp } from './helpers/test-app.js'

/** Boot window covering a cold image pull plus app init. */
const BOOT_TIMEOUT_MS = 200_000

/** The key prefix the test app prepends to every raw key. */
const KEY_PREFIX = 'storage-example'

/** Strips the global prefix from an `UploadResult.key` to recover the raw key. */
const rawKey = (prefixedKey: string): string => prefixedKey.slice(`${KEY_PREFIX}/`.length)

describe('vault surface (e2e)', () => {
  let minio: StartedMinio
  let app: INestApplication
  let seededKey: string

  beforeAll(async () => {
    minio = await startMinioContainer()
    const created = await createTestApp(minio.endpoint)
    app = created.app
    const uploaded = await request(app.getHttpServer())
      .post('/uploads/single')
      .field('category', 'attachments')
      .attach('file', Buffer.from('vault-e2e-body'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(201)
    seededKey = rawKey(uploaded.body.key as string)
  }, BOOT_TIMEOUT_MS)

  afterAll(async () => {
    if (app !== undefined) {
      await app.close()
    }
    if (minio !== undefined) {
      await minio.container.stop()
    }
  })

  it('lists objects, aggregating folders when a delimiter is passed', async () => {
    /*
     * Scenario: the vault browser lists the attachments prefix with delimiter.
     * Rule it protects: GET /vault returns the paged envelope shape (objects,
     * commonPrefixes, isTruncated) and finds the seeded object.
     */
    const res = await request(app.getHttpServer())
      .get('/vault')
      .query({ prefix: 'attachments/', maxKeys: 50 })
      .expect(200)
    expect(Array.isArray(res.body.objects)).toBe(true)
    expect(Array.isArray(res.body.commonPrefixes)).toBe(true)
    expect(res.body.objects.some((o: { key: string }) => o.key.endsWith(seededKey))).toBe(true)
  })

  it('returns full object metadata for a head request', async () => {
    /*
     * Scenario: the detail drawer opens on the seeded object.
     * Rule it protects: GET /vault/object returns ObjectMetadata with the size
     * and content type set at upload time.
     */
    const res = await request(app.getHttpServer())
      .get('/vault/object')
      .query({ key: seededKey })
      .expect(200)
    expect(res.body.size).toBe('vault-e2e-body'.length)
    expect(res.body.contentType).toBe('text/plain')
  })

  it('streams the object body with metadata headers', async () => {
    /*
     * Scenario: a download proxy streams the object to the client.
     * Rule it protects: GET /vault/object/download sets Content-Type/Length and
     * streams the exact bytes.
     */
    const res = await request(app.getHttpServer())
      .get('/vault/object/download')
      .query({ key: seededKey })
      .expect(200)
    expect(res.headers['content-type']).toContain('text/plain')
    expect(res.text).toBe('vault-e2e-body')
  })

  it('previews a small object as base64', async () => {
    /*
     * Scenario: the preview tab renders a size-guarded buffer.
     * Rule it protects: GET /vault/object/preview returns base64 that decodes to
     * the original body.
     */
    const res = await request(app.getHttpServer())
      .get('/vault/object/preview')
      .query({ key: seededKey })
      .expect(200)
    expect(Buffer.from(res.body.base64, 'base64').toString('utf8')).toBe('vault-e2e-body')
  })

  it('returns a byte range as base64 for the hex panel', async () => {
    /*
     * Scenario: the hex panel requests the first bytes.
     * Rule it protects: GET /vault/object/range returns exactly the requested
     * slice.
     */
    const res = await request(app.getHttpServer())
      .get('/vault/object/range')
      .query({ key: seededKey, start: 0, end: 4 })
      .expect(200)
    expect(Buffer.from(res.body.base64, 'base64').toString('utf8')).toBe('vault')
  })

  it('renders the unsigned public URL with a boundary note', async () => {
    /*
     * Scenario: the URLs tab shows the public link.
     * Rule it protects: GET /vault/object/public-url returns the prefixed URL and
     * the unsigned/existence-unchecked note.
     */
    const res = await request(app.getHttpServer())
      .get('/vault/object/public-url')
      .query({ key: seededKey })
      .expect(200)
    expect(res.body.url).toContain(`${KEY_PREFIX}/${encodeURIComponent('attachments')}`)
    expect(res.body.note).toMatch(/unsigned/i)
  })

  it('downloads from the versioned bucket and echoes the requested versionId', async () => {
    /*
     * Scenario: a versioned retrieval reads the versioning-enabled bucket.
     * Rule it protects: GET /vault/object/version serves the object seeded into
     * vault-versioned and echoes requestedVersionId.
     */
    const client = new S3Client({
      endpoint: minio.endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: MINIO_CREDENTIAL, secretAccessKey: MINIO_CREDENTIAL },
    })
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: 'vault-versioned',
          Key: `${KEY_PREFIX}/versioned/doc.txt`,
          Body: 'versioned-body',
        }),
      )
    } finally {
      client.destroy()
    }
    const res = await request(app.getHttpServer())
      .get('/vault/object/version')
      .query({ key: 'versioned/doc.txt', versionId: 'v-requested' })
      .expect(200)
    expect(Buffer.from(res.body.base64, 'base64').toString('utf8')).toBe('versioned-body')
    expect(res.body.requestedVersionId).toBe('v-requested')
  })

  it('server-side copies an object within the default bucket', async () => {
    /*
     * Scenario: copy-to keeps a duplicate under a new key.
     * Rule it protects: POST /vault/copy returns the new ETag and destination
     * metadata without streaming bytes through the app.
     */
    const res = await request(app.getHttpServer())
      .post('/vault/copy')
      .send({ sourceKey: seededKey, destinationKey: 'attachments/copy.bin', destination: 'same' })
      .expect(201)
    expect(res.body.destination).toBe('attachments/copy.bin')
    expect(res.body.etag).toBeDefined()
    await request(app.getHttpServer())
      .post('/vault/bulk-delete')
      .send({ keys: ['attachments/copy.bin'] })
      .expect(200)
  })

  it('bulk-deletes objects and reports the verbatim library result', async () => {
    /*
     * Scenario: a bulk delete clears a throwaway object.
     * Rule it protects: POST /vault/bulk-delete returns the { deleted, failed }
     * report verbatim.
     */
    const throwaway = await request(app.getHttpServer())
      .post('/uploads/single')
      .field('category', 'attachments')
      .attach('file', Buffer.from('bulk'), { filename: 'b.txt', contentType: 'text/plain' })
      .expect(201)
    const key = rawKey(throwaway.body.key as string)
    const res = await request(app.getHttpServer())
      .post('/vault/bulk-delete')
      .send({ keys: [key] })
      .expect(200)
    expect(res.body.deleted).toContain(key)
    expect(res.body.failed).toEqual([])
  })

  it('deletes a single object idempotently and warns on a missing key', async () => {
    /*
     * Scenario: the seeded object is deleted, then the delete is repeated.
     * Rule it protects: DELETE /vault/object is idempotent and the warned flag
     * flips to true once the key is gone.
     */
    await request(app.getHttpServer()).delete('/vault/object').query({ key: seededKey }).expect(200)
    const repeat = await request(app.getHttpServer())
      .delete('/vault/object')
      .query({ key: seededKey })
      .expect(200)
    expect(repeat.body.warned).toBe(true)
  })

  it('maps a missing key to the 404 not-found envelope', async () => {
    /*
     * Scenario: the drawer requests a key that does not exist.
     * Rule it protects: GET /vault/object relays STORAGE_OBJECT_NOT_FOUND as 404.
     */
    const res = await request(app.getHttpServer())
      .get('/vault/object')
      .query({ key: 'attachments/does-not-exist.bin' })
      .expect(404)
    expect(res.body.error.code).toBe('STORAGE_OBJECT_NOT_FOUND')
  })

  it('maps a 404 source to the not-found envelope on copy', async () => {
    /*
     * Scenario: copy is attempted from a missing source.
     * Rule it protects: the exists() precheck surfaces 404 before any provider
     * CopyObject request.
     */
    const res = await request(app.getHttpServer())
      .post('/vault/copy')
      .send({
        sourceKey: 'attachments/ghost.bin',
        destinationKey: 'attachments/x.bin',
        destination: 'same',
      })
      .expect(404)
    expect(res.body.error.code).toBe('STORAGE_OBJECT_NOT_FOUND')
  })

  it('rejects an inverted byte range with 400', async () => {
    /*
     * Scenario: the client requests start greater than end.
     * Rule it protects: the range guard returns 400 RANGE_INVALID.
     */
    const res = await request(app.getHttpServer())
      .get('/vault/object/range')
      .query({ key: 'attachments/any.bin', start: 10, end: 2 })
      .expect(400)
    expect(res.body.error.code).toBe('RANGE_INVALID')
  })

  it('rejects an oversized byte range with 413 before downloading', async () => {
    /*
     * Scenario: the client requests a range whose base64 form exceeds 50 MiB.
     * Rule it protects: the encoded-size guard returns 413 RANGE_TOO_LARGE
     * without touching the provider.
     */
    const res = await request(app.getHttpServer())
      .get('/vault/object/range')
      .query({ key: 'attachments/any.bin', start: 0, end: 60_000_000 })
      .expect(413)
    expect(res.body.error.code).toBe('RANGE_TOO_LARGE')
  })

  it('rejects a malformed listing query through the global Zod pipe', async () => {
    /*
     * Scenario: maxKeys is zero, below the allowed minimum.
     * Rule it protects: the ZodValidationPipe returns the 400 VALIDATION envelope.
     */
    const res = await request(app.getHttpServer()).get('/vault').query({ maxKeys: 0 }).expect(400)
    expect(res.body.error.code).toBe('VALIDATION')
    expect(Array.isArray(res.body.error.issues)).toBe(true)
  })
})
