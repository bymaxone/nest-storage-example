/**
 * E2E: tenant isolation proof against a real MinIO (Testcontainers).
 *
 * Seeds two tenants (`acme` and `globex`) through `POST /tenants/:t/upload`, then
 * proves the application-level prefix boundary end to end: each tenant's listing
 * shows only its own objects (full keys carry the {keyPrefix}/{tenant}/ layering),
 * clearing `acme` deletes only `acme` objects and leaves `globex` intact, and a
 * hostile slug carrying a path separator is rejected before any key is composed.
 *
 * @module test/tenants.e2e-spec
 */
import 'reflect-metadata'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { startMinioContainer, type StartedMinio } from './helpers/minio-container.js'
import { createTestApp } from './helpers/test-app.js'

/** Boot window covering a cold image pull plus app init. */
const BOOT_TIMEOUT_MS = 200_000

/** The global key prefix the test app runs with (from the baseline env). */
const KEY_PREFIX = 'storage-example'

/**
 * Seeds one object for a tenant and returns the composed app key.
 *
 * @param app - The running application.
 * @param tenant - The tenant slug.
 * @param category - The category segment.
 * @returns The app key the object was stored under.
 */
async function seed(app: INestApplication, tenant: string, category: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post(`/tenants/${tenant}/upload`)
    .send({ category, content: `data for ${tenant}` })
    .expect(201)
  expect(res.body.fullKey).toBe(`${KEY_PREFIX}/${res.body.key}`)
  return res.body.key
}

describe('tenant isolation (e2e)', () => {
  let minio: StartedMinio
  let app: INestApplication

  beforeAll(async () => {
    minio = await startMinioContainer()
    const created = await createTestApp(minio.endpoint)
    app = created.app
    await seed(app, 'acme', 'invoices')
    await seed(app, 'globex', 'reports')
  }, BOOT_TIMEOUT_MS)

  afterAll(async () => {
    if (app !== undefined) {
      await app.close()
    }
    if (minio !== undefined) {
      await minio.container.stop()
    }
  })

  it('lists only the owning tenant objects with the full key composition', async () => {
    /*
     * Scenario: each tenant lists its objects.
     * Rule it protects: a listing scoped to {tenant}/ never reveals a sibling tenant,
     * and the full key renders the {keyPrefix}/{tenant}/ layering.
     */
    const acme = await request(app.getHttpServer()).get('/tenants/acme/objects').expect(200)
    expect(acme.body.prefix).toBe('acme/')
    expect(acme.body.objects).toHaveLength(1)
    expect(acme.body.objects[0].key.startsWith('acme/')).toBe(true)
    expect(acme.body.objects[0].fullKey).toBe(`${KEY_PREFIX}/${acme.body.objects[0].key}`)
    const acmeKeys: string[] = acme.body.objects.map((o: { key: string }) => o.key)
    expect(acmeKeys.some((k) => k.startsWith('globex/'))).toBe(false)
  })

  it('clears one tenant and leaves the other intact', async () => {
    /*
     * Scenario: acme is cleared while globex is untouched.
     * Rule it protects: the clear deletes only the acme-prefixed keys the scoped
     * listing produced, so globex objects survive (no cross-tenant deletion).
     */
    const cleared = await request(app.getHttpServer()).delete('/tenants/acme/objects').expect(200)
    expect(cleared.body).toMatchObject({ tenant: 'acme', prefix: 'acme/', failed: 0 })
    expect(cleared.body.deleted).toBeGreaterThanOrEqual(1)

    const acmeAfter = await request(app.getHttpServer()).get('/tenants/acme/objects').expect(200)
    expect(acmeAfter.body.objects).toHaveLength(0)

    const globexAfter = await request(app.getHttpServer())
      .get('/tenants/globex/objects')
      .expect(200)
    expect(globexAfter.body.objects).toHaveLength(1)
    expect(globexAfter.body.objects[0].key.startsWith('globex/')).toBe(true)
  })

  it('rejects a hostile tenant slug before composing a key', async () => {
    /*
     * Scenario: a slug carrying a URL-encoded path separator (%2F) is submitted, so
     * the request still matches the :slug route param but decodes to `acme/globex`.
     * Rule it protects: the Zod slug schema (^[a-z0-9-]{2,32}$) rejects the slash and
     * returns 400, so a traversal attempt never reaches key composition. The dotted
     * `acme..globex` variant is exercised too as a second traversal shape.
     */
    await request(app.getHttpServer()).get('/tenants/acme%2Fglobex/objects').expect(400)
    await request(app.getHttpServer()).get('/tenants/acme..globex/objects').expect(400)
  })
})
