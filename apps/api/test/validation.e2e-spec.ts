/**
 * E2E: validation pipeline against a real MinIO (Testcontainers).
 *
 * Drives `POST /validation/upload` through the real library pipeline with no
 * app-side prechecks, proving each stage fails independently with its documented
 * envelope: a disallowed MIME is 415 `STORAGE_MIME_NOT_ALLOWED`, an oversized
 * body is 413 `STORAGE_SIZE_EXCEEDED`, and a forged PDF is 400
 * `STORAGE_VALIDATION_FAILED` with the validator reason in `details`. A
 * whitelisted PNG within the cap and a genuine `%PDF` body pass, and
 * `GET /validation/rules` renders the active whitelist, size cap, and validator
 * names from the resolved options token.
 *
 * @module test/validation.e2e-spec
 */
import 'reflect-metadata'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { startMinioContainer, type StartedMinio } from './helpers/minio-container.js'
import { createTestApp } from './helpers/test-app.js'
import { forgedPdf, genuinePdf } from '../src/validation-lab/pdf-samples.js'

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

  it('rejects a forged PDF with the 400 validation envelope', async () => {
    /*
     * Scenario: a text body declared as application/pdf reaches the magic-byte validator.
     * Rule it protects: the custom validator rejection maps to 400 STORAGE_VALIDATION_FAILED
     * with the validator name and reason in details.
     */
    const forged = forgedPdf()
    const res = await request(app.getHttpServer())
      .post('/validation/upload')
      .attach('file', forged.buffer, { filename: forged.filename, contentType: forged.contentType })
      .expect(400)
    expect(res.body.error.code).toBe('STORAGE_VALIDATION_FAILED')
    expect(res.body.error.details.validator).toBe('pdf-magic-byte')
    expect(typeof res.body.error.details.reason).toBe('string')
  })

  it('accepts a genuine %PDF body through the same route', async () => {
    /*
     * Scenario: a body whose leading bytes are the real %PDF signature is uploaded.
     * Rule it protects: the magic-byte validator passes a genuine PDF, so it is stored
     * and the response names the validators that ran.
     */
    const genuine = genuinePdf()
    const res = await request(app.getHttpServer())
      .post('/validation/upload')
      .attach('file', genuine.buffer, {
        filename: genuine.filename,
        contentType: genuine.contentType,
      })
      .expect(201)
    expect(res.body.result.contentType).toBe('application/pdf')
    expect(res.body.rules.customValidators).toEqual(['pdf-magic-byte'])
  })
})
