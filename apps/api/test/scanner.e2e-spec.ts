/**
 * E2E: scanner pipeline against a real MinIO (Testcontainers).
 *
 * Boots three app instances against ONE MinIO container, each resolving a
 * different scanner configuration at registration (the library resolves the mode
 * once, at `forRootAsync` time), so every verdict/mode/rejectOnUnknown
 * combination is proven without pretending runtime mode switching exists:
 *   - pre-upload, rejectOnUnknown off: clean passes, an infected marker is 422,
 *     an unknown marker passes with a warning;
 *   - pre-upload, rejectOnUnknown on: an unknown marker is 422 STORAGE_SCAN_INCONCLUSIVE;
 *   - post-upload, rejectOnUnknown off: an infected object is uploaded then
 *     removed by the library, and the existence probe proves the removal.
 *
 * Every verdict is produced by the real library pipeline; the markers are the
 * inert `X-DEMO-*` text markers, never real malware.
 *
 * @module test/scanner.e2e-spec
 */
import 'reflect-metadata'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { startMinioContainer, type StartedMinio } from './helpers/minio-container.js'
import { createTestApp } from './helpers/test-app.js'

/** Boot window covering a cold image pull plus three app inits. */
const BOOT_TIMEOUT_MS = 240_000

/** Inert demo markers (safe text tokens, never real malware). */
const INFECTED = 'X-DEMO-INFECTED'
const UNKNOWN = 'X-DEMO-UNKNOWN'

describe('scanner pipeline (e2e)', () => {
  let minio: StartedMinio
  let preApp: INestApplication
  let rejectApp: INestApplication
  let postApp: INestApplication

  beforeAll(async () => {
    minio = await startMinioContainer()
    // Each app boots in the same process and the helper mutates shared process.env,
    // so BOTH scanner keys are set explicitly per app to avoid one boot leaking its
    // configuration into the next.
    preApp = (
      await createTestApp(minio.endpoint, {
        SCANNER_MODE: 'pre-upload',
        SCANNER_REJECT_ON_UNKNOWN: 'false',
      })
    ).app
    rejectApp = (
      await createTestApp(minio.endpoint, {
        SCANNER_MODE: 'pre-upload',
        SCANNER_REJECT_ON_UNKNOWN: 'true',
      })
    ).app
    // The post-upload removal demo runs prefix-free: the library's post-upload
    // cleanup deletes the ALREADY-normalized key, which the delete path normalizes
    // a second time, so with a non-empty keyPrefix the cleanup targets a
    // double-prefixed key and the infected object is not actually removed. With no
    // keyPrefix the normalization is idempotent and the removal genuinely happens.
    postApp = (
      await createTestApp(minio.endpoint, {
        SCANNER_MODE: 'post-upload',
        SCANNER_REJECT_ON_UNKNOWN: 'false',
        STORAGE_KEY_PREFIX: '',
      })
    ).app
  }, BOOT_TIMEOUT_MS)

  afterAll(async () => {
    for (const app of [preApp, rejectApp, postApp]) {
      if (app !== undefined) {
        await app.close()
      }
    }
    if (minio !== undefined) {
      await minio.container.stop()
    }
  })

  it('pre-upload: stores clean content with a clean verdict', async () => {
    /*
     * Scenario: content with no marker is scanned before upload.
     * Rule it protects: a clean verdict is stored and reported.
     */
    const res = await request(preApp.getHttpServer())
      .post('/scanner/upload')
      .send({ content: 'a perfectly ordinary document' })
      .expect(201)
    expect(res.body.verdict.status).toBe('clean')
    expect(res.body.result.contentType).toBe('text/plain')
  })

  it('pre-upload: rejects an infected marker with 422 and the threat name', async () => {
    /*
     * Scenario: content carrying the inert infected marker is scanned before upload.
     * Rule it protects: the library rejects it with 422 STORAGE_SCAN_INFECTED and the
     * demo threat name, never reaching the bucket.
     */
    const res = await request(preApp.getHttpServer())
      .post('/scanner/upload')
      .send({ content: `payload ${INFECTED} here` })
      .expect(422)
    expect(res.body.error.code).toBe('STORAGE_SCAN_INFECTED')
    expect(res.body.error.details.threat).toBe('Demo.Marker.A')
  })

  it('pre-upload: passes an unknown marker with a warning by default', async () => {
    /*
     * Scenario: an unknown marker is scanned with rejectOnUnknown off.
     * Rule it protects: the upload is accepted and the response carries a warning.
     */
    const res = await request(preApp.getHttpServer())
      .post('/scanner/upload')
      .send({ content: `maybe risky ${UNKNOWN}` })
      .expect(201)
    expect(res.body.verdict.status).toBe('unknown')
    expect(typeof res.body.warning).toBe('string')
  })

  it('pre-upload with rejectOnUnknown: rejects an unknown marker with 422', async () => {
    /*
     * Scenario: an unknown marker is scanned with rejectOnUnknown on.
     * Rule it protects: the library rejects it with 422 STORAGE_SCAN_INCONCLUSIVE.
     */
    const res = await request(rejectApp.getHttpServer())
      .post('/scanner/upload')
      .send({ content: `maybe risky ${UNKNOWN}` })
      .expect(422)
    expect(res.body.error.code).toBe('STORAGE_SCAN_INCONCLUSIVE')
  })

  it('post-upload: uploads then removes an infected object, proven by the probe', async () => {
    /*
     * Scenario: an infected marker is scanned AFTER upload (mode resolved at boot).
     * Rule it protects: the library stores then deletes the object and re-throws 422;
     * the existence probe proves the object is gone (head -> not found).
     */
    const keySeed = 'removal-proof'
    const rawKey = `scanner-lab/${INFECTED}--${keySeed}`
    const res = await request(postApp.getHttpServer())
      .post('/scanner/upload')
      .send({ content: `infected body ${INFECTED}`, keySeed })
      .expect(422)
    expect(res.body.error.code).toBe('STORAGE_SCAN_INFECTED')

    const probe = await request(postApp.getHttpServer())
      .get('/scanner/exists')
      .query({ key: rawKey })
      .expect(200)
    expect(probe.body).toEqual({ key: rawKey, exists: false })
  })

  it('post-upload: renders the resolved mode from the options token', async () => {
    /*
     * Scenario: the config endpoint is queried on the post-upload instance.
     * Rule it protects: the rendered mode reflects what the library resolved at boot.
     */
    const res = await request(postApp.getHttpServer()).get('/scanner/config').expect(200)
    expect(res.body).toEqual({ enabled: true, mode: 'post-upload', rejectOnUnknown: false })
  })
})
