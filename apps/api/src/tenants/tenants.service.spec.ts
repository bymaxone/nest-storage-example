/**
 * Unit: TenantsService - composes tenant-scoped keys under the single instance
 * prefix and clears strictly within a tenant prefix.
 *
 * Mocks `StorageService.upload`/`list`/`deleteMany`. Covers the composed key
 * (default and custom extension), full-key rendering with and without a global
 * prefix, category-narrowed and cursor-paged listing, next-cursor propagation,
 * and the paged clear across a single page, multiple pages, and partial failures.
 *
 * @module tenants/tenants.service.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import type {
  DeleteManyResult,
  ListResult,
  StorageService,
  UploadResult,
} from '@bymax-one/nest-storage'
import { TenantsService, type TenantPrefixOptions } from './tenants.service.js'

/** A minimal successful upload result for the composed key. */
function makeUploadResult(key: string): UploadResult {
  return {
    key: `storage-example/${key}`,
    bucket: 'vault',
    etag: '"abc"',
    contentType: 'text/plain',
    publicUrl: `http://localhost:9000/vault/storage-example/${key}`,
    multipart: false,
    fromIdempotencyCache: false,
  }
}

/** Builds one listed-object row with a deterministic size and etag. */
function listedObject(key: string): ListResult['objects'][number] {
  return { key, size: 3, etag: '"e"', lastModified: new Date(0) }
}

/**
 * Builds the service with a mocked storage and a chosen global key prefix.
 *
 * @param options - The prefix options exposed via the token.
 * @returns The service and its mocked storage functions.
 */
function setup(options: TenantPrefixOptions = { keyPrefix: 'storage-example' }) {
  const upload = jest.fn<StorageService['upload']>()
  const list = jest.fn<StorageService['list']>()
  const deleteMany = jest.fn<StorageService['deleteMany']>()
  const storage = { upload, list, deleteMany } as unknown as StorageService
  const service = new TenantsService(storage, options)
  return { service, upload, list, deleteMany }
}

describe('TenantsService (unit)', () => {
  it('composes the tenant key with a default extension and full-key rendering', async () => {
    /*
     * Scenario: a tenant uploads without specifying an extension.
     * Rule it protects: the key is {tenant}/{category}/{uuid}.txt and the full key
     * carries the global prefix so the layering is observable.
     */
    const { service, upload } = setup()
    upload.mockImplementation((o) => Promise.resolve(makeUploadResult(o.key)))
    const res = await service.upload('acme', { category: 'invoices', content: 'hello' })
    expect(res.key).toMatch(/^acme\/invoices\/[0-9a-f-]+\.txt$/)
    expect(res.fullKey).toBe(`storage-example/${res.key}`)
    expect(res.tenant).toBe('acme')
    expect(res.note).toContain('application-level')
  })

  it('honors a caller-supplied extension in the composed key', async () => {
    /*
     * Scenario: a tenant uploads with an explicit extension.
     * Rule it protects: the extension becomes the key suffix.
     */
    const { service, upload } = setup()
    upload.mockImplementation((o) => Promise.resolve(makeUploadResult(o.key)))
    const res = await service.upload('acme', { category: 'docs', content: 'x', extension: 'csv' })
    expect(res.key).toMatch(/\.csv$/)
    const sent = upload.mock.calls[0]?.[0]
    expect(sent?.contentType).toBe('text/plain')
    expect(sent?.size).toBe(1)
  })

  it('renders the full key without a leading separator when no global prefix is set', async () => {
    /*
     * Scenario: the module runs with an empty keyPrefix.
     * Rule it protects: the full key equals the app key (no stray leading slash).
     */
    const { service, upload } = setup({ keyPrefix: '' })
    upload.mockImplementation((o) => Promise.resolve(makeUploadResult(o.key)))
    const res = await service.upload('globex', { category: 'a', content: 'y' })
    expect(res.fullKey).toBe(res.key)
  })

  it('lists strictly within the tenant prefix and maps objects with full keys', async () => {
    /*
     * Scenario: a bare tenant listing with no category, cursor, or maxKeys.
     * Rule it protects: the prefix is {tenant}/ and every object renders its full key.
     */
    const { service, list } = setup()
    list.mockResolvedValue({
      objects: [listedObject('acme/invoices/1.txt')],
      commonPrefixes: [],
      isTruncated: false,
    })
    const res = await service.list('acme', {})
    expect(list.mock.calls[0]?.[0]).toEqual({ prefix: 'acme/' })
    expect(res.objects[0]?.fullKey).toBe('storage-example/acme/invoices/1.txt')
    expect(res.nextCursor).toBeUndefined()
    // The key is OMITTED (not set to undefined) when the provider returns no
    // continuation token, so a mutant that always spreads the cursor is caught.
    expect('nextCursor' in res).toBe(false)
  })

  it('narrows the listing to a category and threads cursor plus maxKeys', async () => {
    /*
     * Scenario: a category-narrowed, paged listing.
     * Rule it protects: the prefix includes the category and the cursor/maxKeys pass through.
     */
    const { service, list } = setup()
    list.mockResolvedValue({
      objects: [],
      commonPrefixes: [],
      isTruncated: true,
      nextContinuationToken: 'next',
    })
    const res = await service.list('acme', { category: 'invoices', cursor: 'c1', maxKeys: 10 })
    expect(list.mock.calls[0]?.[0]).toEqual({
      prefix: 'acme/invoices/',
      maxKeys: 10,
      continuationToken: 'c1',
    })
    expect(res.nextCursor).toBe('next')
  })

  it('clears a tenant in a single page and reports the deleted count', async () => {
    /*
     * Scenario: a tenant with a single page of objects is cleared.
     * Rule it protects: only the listed keys are deleted and the count is reported.
     */
    const { service, list, deleteMany } = setup()
    list.mockResolvedValue({
      objects: [listedObject('acme/a/1.txt'), listedObject('acme/a/2.txt')],
      commonPrefixes: [],
      isTruncated: false,
    })
    deleteMany.mockResolvedValue({ deleted: ['acme/a/1.txt', 'acme/a/2.txt'], failed: [] })
    const res = await service.clear('acme')
    expect(deleteMany.mock.calls[0]?.[0]).toEqual(['acme/a/1.txt', 'acme/a/2.txt'])
    expect(res).toMatchObject({ tenant: 'acme', prefix: 'acme/', deleted: 2, failed: 0 })
  })

  it('pages through multiple listing pages when clearing', async () => {
    /*
     * Scenario: a tenant spans two listing pages.
     * Rule it protects: the clear follows the continuation token until exhausted.
     */
    const { service, list, deleteMany } = setup()
    const firstPage: ListResult = {
      objects: [listedObject('acme/a/1.txt')],
      commonPrefixes: [],
      isTruncated: true,
      nextContinuationToken: 'page2',
    }
    const secondPage: ListResult = {
      objects: [listedObject('acme/a/2.txt')],
      commonPrefixes: [],
      isTruncated: false,
    }
    list.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage)
    deleteMany.mockImplementation((keys) =>
      Promise.resolve({ deleted: keys, failed: [] } as DeleteManyResult),
    )
    const res = await service.clear('acme')
    expect(list.mock.calls[1]?.[0]).toEqual({ prefix: 'acme/', continuationToken: 'page2' })
    expect(res.deleted).toBe(2)
  })

  it('skips deleteMany for an empty page and records provider failures', async () => {
    /*
     * Scenario: a first empty page followed by a page with a failed key.
     * Rule it protects: no delete is issued for an empty page and failures are aggregated.
     */
    const { service, list, deleteMany } = setup()
    list
      .mockResolvedValueOnce({
        objects: [],
        commonPrefixes: [],
        isTruncated: true,
        nextContinuationToken: 'p2',
      })
      .mockResolvedValueOnce({
        objects: [listedObject('acme/a/3.txt')],
        commonPrefixes: [],
        isTruncated: false,
      })
    deleteMany.mockResolvedValue({
      deleted: [],
      failed: [{ key: 'acme/a/3.txt', error: 'AccessDenied' }],
    })
    const res = await service.clear('acme')
    expect(deleteMany).toHaveBeenCalledTimes(1)
    expect(res).toMatchObject({ deleted: 0, failed: 1 })
    expect(res.failures[0]).toEqual({ key: 'acme/a/3.txt', error: 'AccessDenied' })
  })
})
