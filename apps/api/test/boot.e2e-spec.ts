/**
 * E2E: application bootstrap smoke against a real MinIO (Testcontainers).
 *
 * Boots the real Nest application through `createApp()` pointed at a
 * Testcontainers MinIO and asserts the root identity route and the health probe
 * respond with their documented shapes, then closes cleanly. This proves the
 * `createApp` seam wires a listenable app against a genuine provider, identically
 * on a developer machine and on a Docker-equipped CI runner (no dev compose).
 *
 * @module test/boot.e2e-spec
 */
import 'reflect-metadata'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { startMinioContainer, type StartedMinio } from './helpers/minio-container.js'
import { createTestApp } from './helpers/test-app.js'

/** Boot window covering a cold image pull plus app init. */
const BOOT_TIMEOUT_MS = 200_000

describe('application bootstrap (e2e)', () => {
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

  it('GET / returns the service identity shape with HTTP 200', async () => {
    /*
     * Scenario: a fresh boot receives a request on the root route.
     * Rule it protects: the app initialises and serves `{ name, version, docs }`,
     * confirming the createApp seam produces a working HTTP application.
     */
    const response = await request(app.getHttpServer()).get('/')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      name: 'nest-storage-example',
      version: '0.0.0',
      docs: '/system/recipes',
    })
  })

  it('GET /health reports up with a numeric latency against the container MinIO', async () => {
    /*
     * Scenario: the health probe runs against the running MinIO container.
     * Rule it protects: the sentinel exists() probe resolves, so health reports
     * status up, the default bucket, and a non-negative latency reading.
     */
    const response = await request(app.getHttpServer()).get('/health')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('up')
    expect(response.body.bucket).toBe('vault')
    expect(typeof response.body.latencyMs).toBe('number')
  })
})
