/**
 * E2E: validation pipeline against a real MinIO (Testcontainers).
 *
 * Drives `POST /validation/upload` through the real library pipeline with no
 * app-side prechecks, proving each stage fails independently with its documented
 * envelope: a disallowed MIME is 415 `STORAGE_MIME_NOT_ALLOWED` and an oversized
 * body is 413 `STORAGE_SIZE_EXCEEDED`. A whitelisted PNG within the cap passes,
 * and `GET /validation/rules` renders the active whitelist, size cap, and
 * validator names from the resolved options token.
 *
 * @module test/validation.e2e-spec
 */
import 'reflect-metadata'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { startMinioContainer, type StartedMinio } from './helpers/minio-container.js'
import { createTestApp } from './helpers/test-app.js'

/** Size policy applied to this suite so the oversized case uses tiny bodies. */
const MAX_SIZE_BYTES = 1024

/** Boot window covering a cold image pull plus app init. */
const BOOT_TIMEOUT_MS = 200_000

describe('validation pipeline (e2e)', () => {
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

  it('accepts a whitelisted PNG within the size cap', async () => {
    /*
     * Scenario: a small PNG (whitelisted MIME, under the cap) is uploaded.
     * Rule it protects: a body that clears every stage is stored and the response
     * names the active rules that accepted it.
     */
    const res = await request(app.getHttpServer())
      .post('/validation/upload')
      .attach('file', Buffer.alloc(64, 1), { filename: 'a.png', contentType: 'image/png' })
      .expect(201)
    expect(res.body.result.contentType).toBe('image/png')
    expect(res.body.rules.customValidators).toContain('pdf-magic-byte')
  })

  it('rejects a non-whitelisted MIME with the 415 envelope', async () => {
    /*
     * Scenario: an application/zip body is uploaded against an image/doc/video whitelist.
     * Rule it protects: the library rejects the MIME with 415 STORAGE_MIME_NOT_ALLOWED.
     */
    const res = await request(app.getHttpServer())
      .post('/validation/upload')
      .attach('file', Buffer.alloc(32, 2), { filename: 'a.zip', contentType: 'application/zip' })
      .expect(415)
    expect(res.body.error.code).toBe('STORAGE_MIME_NOT_ALLOWED')
    expect(res.body.error.details.contentType).toBe('application/zip')
  })

  it('rejects an oversized body with the 413 envelope', async () => {
    /*
     * Scenario: a whitelisted PNG larger than the configured cap is uploaded.
     * Rule it protects: the library rejects the size with 413 STORAGE_SIZE_EXCEEDED.
     */
    const res = await request(app.getHttpServer())
      .post('/validation/upload')
      .attach('file', Buffer.alloc(MAX_SIZE_BYTES + 512, 3), {
        filename: 'big.png',
        contentType: 'image/png',
      })
      .expect(413)
    expect(res.body.error.code).toBe('STORAGE_SIZE_EXCEEDED')
    expect(res.body.error.details.maxSize).toBe(MAX_SIZE_BYTES)
  })

  it('renders the active rules from the resolved options token', async () => {
    /*
     * Scenario: the rules endpoint is queried.
     * Rule it protects: the whitelist, size cap, and validator names reflect what the
     * module runs with (the video/* wildcard, the configured cap, the pdf validator).
     */
    const res = await request(app.getHttpServer()).get('/validation/rules').expect(200)
    expect(res.body.mimeWhitelist).toContain('video/*')
    expect(res.body.maxSizeBytes).toBe(MAX_SIZE_BYTES)
    expect(res.body.customValidators).toEqual(['pdf-magic-byte'])
  })
})
