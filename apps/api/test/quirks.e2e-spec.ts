/**
 * E2E: provider quirks against a real MinIO (Testcontainers).
 *
 * Drives the checksum demo through the real library twice (WHEN_SUPPORTED via a
 * scoped instance, WHEN_REQUIRED via the running module) and asserts the honest
 * outcome: the WHEN_REQUIRED upload always succeeds; whether WHEN_SUPPORTED
 * diverges is version-dependent, so the test asserts structure and, when the
 * modes agree, records the skip-with-reason that this MinIO build accepts the SDK
 * default checksums. Also asserts the ACL and network cards render.
 *
 * @module test/quirks.e2e-spec
 */
import 'reflect-metadata'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { startMinioContainer, type StartedMinio } from './helpers/minio-container.js'
import { createTestApp } from './helpers/test-app.js'

/** Boot window covering a cold image pull plus app init. */
const BOOT_TIMEOUT_MS = 200_000

describe('provider quirks (e2e)', () => {
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

  it('runs the checksum demo and reports both real outcomes honestly', async () => {
    /*
     * Scenario: the same body is uploaded in both checksum modes against MinIO.
     * Rule it protects: WHEN_REQUIRED always succeeds; WHEN_SUPPORTED divergence is
     * version-dependent, so the demo reports the real outcome without faking failure.
     */
    const res = await request(app.getHttpServer()).post('/system/quirks/checksum-demo').expect(200)
    expect(res.body.requiredMode.ok).toBe(true)
    expect(res.body.supportedMode.mode).toBe('WHEN_SUPPORTED')
    if (res.body.diverged) {
      expect(res.body.supportedMode.ok).toBe(false)
    } else {
      // Skip-with-reason: this MinIO build accepts the SDK default checksums, so
      // the trap does not reproduce locally (the library documents this caveat).
      expect(res.body.supportedMode.ok).toBe(true)
    }
  })

  it('renders the ACL honesty card', async () => {
    /*
     * Scenario: the ACL card is queried.
     * Rule it protects: the documented cross-provider behavior and mapped code render.
     */
    const res = await request(app.getHttpServer()).get('/system/quirks/acl').expect(200)
    expect(res.body.mappedErrorCode).toBe('STORAGE_PROVIDER_ERROR')
    expect(res.body.guidance.length).toBeGreaterThanOrEqual(3)
  })

  it('renders the network knobs card', async () => {
    /*
     * Scenario: the network card is queried.
     * Rule it protects: retries = maxAttempts - 1 and the requestTimeoutMs caveat render.
     */
    const res = await request(app.getHttpServer()).get('/system/quirks/network').expect(200)
    expect(res.body.retries).toBe(res.body.maxAttempts - 1)
    expect(typeof res.body.caveat).toBe('string')
  })
})
