/**
 * Unit: TenantsController - thin delegation to the service.
 *
 * Constructs the controller with a mocked service and covers the upload, list,
 * and clear delegations. Also imports the DTO schemas to assert the tenant slug
 * character class rejects a path separator and a parent-directory segment.
 *
 * @module tenants/tenants.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { TenantsController } from './tenants.controller.js'
import type {
  TenantClearView,
  TenantListView,
  TenantsService,
  TenantUploadView,
} from './tenants.service.js'
import { tenantSlugSchema } from './dto/tenant-params.dto.js'

/**
 * Builds the controller with a mocked service.
 *
 * @returns The controller and its mocked service functions.
 */
function setup() {
  const upload = jest.fn<TenantsService['upload']>()
  const list = jest.fn<TenantsService['list']>()
  const clear = jest.fn<TenantsService['clear']>()
  const service = { upload, list, clear } as unknown as TenantsService
  const controller = new TenantsController(service)
  return { controller, upload, list, clear }
}

describe('TenantsController (unit)', () => {
  it('delegates an upload to the service', async () => {
    /*
     * Scenario: a tenant upload request arrives.
     * Rule it protects: the controller forwards the slug and body to the service.
     */
    const { controller, upload } = setup()
    const view = { tenant: 'acme', key: 'acme/a/1.txt' } as TenantUploadView
    upload.mockResolvedValue(view)
    const body = { category: 'a', content: 'x' }
    await expect(controller.upload('acme', body)).resolves.toBe(view)
    expect(upload).toHaveBeenCalledWith('acme', body)
  })

  it('delegates a listing to the service', async () => {
    /*
     * Scenario: a tenant listing request arrives.
     * Rule it protects: the controller forwards the slug and query to the service.
     */
    const { controller, list } = setup()
    const view = { tenant: 'acme', prefix: 'acme/', objects: [] } as unknown as TenantListView
    list.mockResolvedValue(view)
    await expect(controller.list('acme', { category: 'a' })).resolves.toBe(view)
    expect(list).toHaveBeenCalledWith('acme', { category: 'a' })
  })

  it('delegates a clear to the service', async () => {
    /*
     * Scenario: a tenant clear request arrives.
     * Rule it protects: the controller forwards the slug to the service.
     */
    const { controller, clear } = setup()
    const view = { tenant: 'acme', prefix: 'acme/', deleted: 0 } as unknown as TenantClearView
    clear.mockResolvedValue(view)
    await expect(controller.clear('acme')).resolves.toBe(view)
    expect(clear).toHaveBeenCalledWith('acme')
  })

  it('rejects a tenant slug carrying a path separator or parent segment', () => {
    /*
     * Scenario: hostile tenant slugs are validated.
     * Rule it protects: the slug character class excludes `/` and `..` so a slug
     * can never escape its own prefix when composed into a key.
     */
    expect(tenantSlugSchema.safeParse('a/b').success).toBe(false)
    expect(tenantSlugSchema.safeParse('..').success).toBe(false)
    expect(tenantSlugSchema.safeParse('acme').success).toBe(true)
  })
})
