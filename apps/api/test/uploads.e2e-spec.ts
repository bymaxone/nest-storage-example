/**
 * E2E: the server-side upload strategies against a real MinIO (Testcontainers).
 *
 * Exercises every `/uploads` route from the spec §11.1 catalogue: single-shot,
 * multipart with a progress session, the progress-snapshot poll, streaming with
 * forced multipart, idempotent deduplication (cache hit on the second call), and
 * the per-call SSE override. Error paths (missing file 400, unknown/malformed
 * session 404) are asserted on the same app.
 *
 * @module test/uploads.e2e-spec
 */
import 'reflect-metadata'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { startMinioContainer, type StartedMinio } from './helpers/minio-container.js'
import { createTestApp } from './helpers/test-app.js'

/** Boot window covering a cold image pull plus app init. */
const BOOT_TIMEOUT_MS = 200_000

describe('upload strategies (e2e)', () => {
  let minio: StartedMinio
  let app: INestApplication

  beforeAll(async () => {
    minio = await startMinioContainer()
    const created = await createTestApp(minio.endpoint)
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

  it('uploads a single-shot file and returns the library UploadResult', async () => {
    /*
     * Scenario: a small file is uploaded in one shot.
     * Rule it protects: POST /uploads/single returns 201 with a prefixed key and
     * multipart:false for a sub-threshold body.
     */
    const res = await request(app.getHttpServer())
      .post('/uploads/single')
      .field('category', 'avatars')
      .attach('file', Buffer.from('single-shot'), { filename: 'a.txt', contentType: 'text/plain' })
      .expect(201)
    expect(res.body.key).toContain('avatars/')
    expect(res.body.multipart).toBe(false)
  })

  it('rejects a single upload with no file attached', async () => {
    /*
     * Scenario: the multipart form omits the file part.
     * Rule it protects: the controller guard returns 400 VALIDATION.
     */
    const res = await request(app.getHttpServer())
      .post('/uploads/single')
      .field('category', 'avatars')
      .expect(400)
    expect(res.body.error.code).toBe('VALIDATION')
  })

  it('records a progress session for a multipart upload and polls it back', async () => {
    /*
     * Scenario: an upload creates a session and the client polls its snapshots.
     * Rule it protects: POST /uploads/multipart returns a sessionId and
     * GET /uploads/sessions/:id returns the recorded snapshots including the
     * final resolved strategy.
     */
    const upload = await request(app.getHttpServer())
      .post('/uploads/multipart')
      .field('category', 'media')
      .attach('file', Buffer.from('multipart-body'), {
        filename: 'm.txt',
        contentType: 'text/plain',
      })
      .expect(201)
    const sessionId = upload.body.sessionId as string
    const session = await request(app.getHttpServer())
      .get(`/uploads/sessions/${sessionId}`)
      .expect(200)
    expect(session.body.id).toBe(sessionId)
    expect(session.body.snapshots.length).toBeGreaterThan(0)
    expect(session.body.snapshots.at(-1).strategy).toBeDefined()
  })

  it('returns 404 for a well-formed but unknown session id', async () => {
    /*
     * Scenario: a valid-looking UUID that was never created is polled.
     * Rule it protects: GET /uploads/sessions/:id returns 404 SESSION_NOT_FOUND.
     */
    const res = await request(app.getHttpServer())
      .get('/uploads/sessions/00000000-0000-4000-8000-000000000000')
      .expect(404)
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND')
  })

  it('returns 404 for a malformed session id', async () => {
    /*
     * Scenario: a non-UUID session id is polled.
     * Rule it protects: the UUID guard rejects it as 404 rather than echoing it.
     */
    const res = await request(app.getHttpServer()).get('/uploads/sessions/not-a-uuid').expect(404)
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND')
  })

  it('streams a raw body with forced multipart when size is unknown', async () => {
    /*
     * Scenario: a stream upload withholds the size hint.
     * Rule it protects: POST /uploads/stream?knownSize=false uploads via the
     * multipart path and returns 201 with a sessionId.
     */
    const res = await request(app.getHttpServer())
      .post('/uploads/stream')
      .query({ category: 'media', knownSize: 'false', filename: 'stream.txt' })
      .set('Content-Type', 'text/plain')
      .send('streamed-body-content')
      .expect(201)
    expect(res.body.sessionId).toBeDefined()
    expect(res.body.result.key).toContain('media/')
  })

  it('deduplicates a repeated idempotent upload from the in-memory cache', async () => {
    /*
     * Scenario: the same idempotencyKey is uploaded twice.
     * Rule it protects: the first call writes (fromIdempotencyCache:false), the
     * second returns the cached result (fromIdempotencyCache:true).
     */
    const body = { idempotencyKey: 'e2e-key-1', content: 'idem', contentType: 'text/plain' }
    const first = await request(app.getHttpServer())
      .post('/uploads/idempotent')
      .send(body)
      .expect(201)
    expect(first.body.result.fromIdempotencyCache).toBe(false)
    const second = await request(app.getHttpServer())
      .post('/uploads/idempotent')
      .send(body)
      .expect(201)
    expect(second.body.result.fromIdempotencyCache).toBe(true)
  })

  it('uploads with a per-call SSE override', async () => {
    /*
     * Scenario: a file is uploaded with the NONE encryption sentinel.
     * Rule it protects: POST /uploads/sse-override returns 201 for the per-call
     * override.
     */
    const res = await request(app.getHttpServer())
      .post('/uploads/sse-override')
      .field('category', 'invoices')
      .field('serverSideEncryption', 'NONE')
      .attach('file', Buffer.from('sse-body'), { filename: 's.txt', contentType: 'text/plain' })
      .expect(201)
    expect(res.body.key).toContain('invoices/')
  })
})
