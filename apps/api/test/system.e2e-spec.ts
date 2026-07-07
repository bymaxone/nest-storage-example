/**
 * E2E: the system introspection surface against a real MinIO (Testcontainers).
 *
 * Covers the two introspection routes from the spec §11.1 catalogue not already
 * exercised by the health/versioning/quirks suites: the resolved config with
 * credentials redacted, and the annotated provider recipes.
 *
 * @module test/system.e2e-spec
 */
import 'reflect-metadata'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { startMinioContainer, type StartedMinio } from './helpers/minio-container.js'
import { createTestApp } from './helpers/test-app.js'

/** Boot window covering a cold image pull plus app init. */
const BOOT_TIMEOUT_MS = 200_000

/** The dev credential the container and app share; must never appear in config output. */
const MINIO_SECRET = 'minioadmin'

describe('system introspection (e2e)', () => {
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

  it('returns the resolved config with credentials redacted', async () => {
    /*
     * Scenario: the system page renders the resolved module options.
     * Rule it protects: GET /system/config never leaks the raw secret; the
     * secretAccessKey is replaced by the redaction marker.
     */
    const res = await request(app.getHttpServer()).get('/system/config').expect(200)
    expect(res.body.credentials.secretAccessKey).toBe('[redacted]')
    expect(JSON.stringify(res.body)).not.toContain(MINIO_SECRET)
  })

  it('returns one annotated recipe per supported provider', async () => {
    /*
     * Scenario: the recipes tab renders the provider matrix.
     * Rule it protects: GET /system/recipes returns an array with a provider
     * label on every row.
     */
    const res = await request(app.getHttpServer()).get('/system/recipes').expect(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(6)
    expect(res.body.every((row: { provider: string }) => row.provider.length > 0)).toBe(true)
  })
})
