/**
 * E2E: error explorer against a real MinIO (Testcontainers).
 *
 * Fetches the catalogue, then walks every shipped code through
 * `POST /errors/:code`: a reproducible code returns its library-mapped status and
 * the untouched `{ error: { code } }` envelope (relayed by the global filter), and
 * the one non-reproducible code returns the honest 200 explanation. The walk runs
 * twice to prove the triggers are deterministic (no reliance on provider luck).
 *
 * @module test/errors.e2e-spec
 */
import 'reflect-metadata'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { startMinioContainer, type StartedMinio } from './helpers/minio-container.js'
import { createTestApp } from './helpers/test-app.js'

/** Boot window covering a cold image pull plus app init. */
const BOOT_TIMEOUT_MS = 200_000

/** One catalogue row as returned by GET /errors. */
interface CatalogueRow {
  code: string
  status: number
  reproducible: boolean
}

describe('error explorer (e2e)', () => {
  let minio: StartedMinio
  let app: INestApplication
  let catalogue: CatalogueRow[]

  beforeAll(async () => {
    minio = await startMinioContainer()
    const created = await createTestApp(minio.endpoint)
    app = created.app
    const res = await request(app.getHttpServer()).get('/errors').expect(200)
    catalogue = res.body as CatalogueRow[]
  }, BOOT_TIMEOUT_MS)

  afterAll(async () => {
    if (app !== undefined) {
      await app.close()
    }
    if (minio !== undefined) {
      await minio.container.stop()
    }
  })

  /**
   * Walks every catalogue code, asserting the reproducible codes render their
   * library-mapped status and envelope and the non-reproducible code explains itself.
   */
  async function walk(): Promise<void> {
    for (const row of catalogue) {
      const res = await request(app.getHttpServer()).post(`/errors/${row.code}`)
      if (row.reproducible) {
        expect(res.status).toBe(row.status)
        expect(res.body.error.code).toBe(row.code)
      } else {
        expect(res.status).toBe(200)
        expect(res.body).toMatchObject({ code: row.code, reproducible: false })
      }
    }
  }

  it('renders an exhaustive catalogue including the reconciled 18th code', () => {
    /*
     * Scenario: the catalogue is inspected.
     * Rule it protects: it is exhaustive and includes STORAGE_INVALID_PART_COUNT
     * (present in the shipped library, omitted from spec §18).
     */
    expect(catalogue.length).toBeGreaterThanOrEqual(18)
    expect(catalogue.some((row) => row.code === 'STORAGE_INVALID_PART_COUNT')).toBe(true)
  })

  it('reproduces every code with its documented status and envelope', async () => {
    /*
     * Scenario: each code is triggered through the real library.
     * Rule it protects: every reproducible code renders its mapped status + envelope,
     * and the non-reproducible code returns the honest explanation.
     */
    await walk()
  }, 120_000)

  it('reproduces every code again (determinism)', async () => {
    /*
     * Scenario: the walk is repeated.
     * Rule it protects: triggers are deterministic and self-contained (no flakiness).
     */
    await walk()
  }, 120_000)
})
