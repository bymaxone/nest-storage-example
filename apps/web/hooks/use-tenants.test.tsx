/**
 * @fileoverview Unit tests for tenant isolation hooks.
 * @layer hooks/use-tenants.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTenantsList, useTenantObjects, useTenantUpload, useTenantClear } from './use-tenants'

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  apiPostForm: vi.fn(),
}))

import { apiGet, apiDelete, apiPostForm } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

const uploadResult = {
  key: 'tenant-a/uploads/file.png',
  bucket: 'vault',
  etag: '"abc"',
  contentType: 'image/png',
  publicUrl: 'http://localhost:9000/vault/tenant-a/uploads/file.png',
  multipart: false,
  fromIdempotencyCache: false,
}

describe('useTenantsList', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())

  it('fetches /tenants', async () => {
    mockGet.mockResolvedValueOnce({ tenants: ['alpha', 'beta'] })
    const { result } = renderHook(() => useTenantsList(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/tenants')
  })
})

describe('useTenantObjects', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())

  it('fetches /tenants/:tenant/objects', async () => {
    mockGet.mockResolvedValueOnce({ objects: [], prefix: 'alpha/' })
    const { result } = renderHook(() => useTenantObjects('alpha'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/tenants/alpha/objects')
  })

  it('is disabled for empty tenant string', () => {
    const { result } = renderHook(() => useTenantObjects(''), { wrapper: wrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('encodes special characters in tenant name', async () => {
    mockGet.mockResolvedValueOnce({ objects: [], prefix: 'tenant/a/' })
    const { result } = renderHook(() => useTenantObjects('tenant/a'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/tenants/tenant%2Fa/objects')
  })
})

describe('useTenantUpload', () => {
  const mockPostForm = vi.mocked(apiPostForm)
  beforeEach(() => mockPostForm.mockReset())

  it('posts FormData to /tenants/:tenant/upload', async () => {
    mockPostForm.mockResolvedValueOnce(uploadResult)
    const { result } = renderHook(() => useTenantUpload(), { wrapper: wrapper() })
    const file = new File(['data'], 'file.png', { type: 'image/png' })
    await act(async () => {
      await result.current.mutateAsync({ tenant: 'alpha', file })
    })
    expect(mockPostForm).toHaveBeenCalledWith('/tenants/alpha/upload', expect.any(FormData))
  })

  it('encodes special characters in tenant name', async () => {
    mockPostForm.mockResolvedValueOnce(uploadResult)
    const { result } = renderHook(() => useTenantUpload(), { wrapper: wrapper() })
    const file = new File(['data'], 'file.png', { type: 'image/png' })
    await act(async () => {
      await result.current.mutateAsync({ tenant: 'tenant/a', file })
    })
    expect(mockPostForm).toHaveBeenCalledWith('/tenants/tenant%2Fa/upload', expect.any(FormData))
  })
})

describe('useTenantClear', () => {
  const mockDelete = vi.mocked(apiDelete)
  beforeEach(() => mockDelete.mockReset())

  it('calls apiDelete on /tenants/:tenant/objects', async () => {
    mockDelete.mockResolvedValueOnce({ deleted: 3, keys: ['a', 'b', 'c'] })
    const { result } = renderHook(() => useTenantClear(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync('alpha')
    })
    expect(mockDelete).toHaveBeenCalledWith('/tenants/alpha/objects')
  })

  it('encodes special characters in tenant name', async () => {
    mockDelete.mockResolvedValueOnce({ deleted: 0, keys: [] })
    const { result } = renderHook(() => useTenantClear(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync('tenant/a')
    })
    expect(mockDelete).toHaveBeenCalledWith('/tenants/tenant%2Fa/objects')
  })
})

describe('tenant form fields, cache invalidation, and query keys', () => {
  const mockGet = vi.mocked(apiGet)
  const mockPostForm = vi.mocked(apiPostForm)
  const mockDelete = vi.mocked(apiDelete)
  beforeEach(() => {
    mockGet.mockReset()
    mockPostForm.mockReset()
    mockDelete.mockReset()
  })

  function clientWithSpy() {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const Wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    return { invalidate, Wrap }
  }

  // Scenario: the tenant upload appends the file under the exact 'file' field.
  it('appends the file under the "file" field', async () => {
    let form: FormData | undefined
    mockPostForm.mockImplementation((_p: string, f: FormData) => {
      form = f
      return Promise.resolve(uploadResult)
    })
    const { Wrap } = clientWithSpy()
    const { result } = renderHook(() => useTenantUpload(), { wrapper: Wrap })
    const file = new File(['data'], 'file.png', { type: 'image/png' })
    await act(async () => {
      await result.current.mutateAsync({ tenant: 'alpha', file })
    })
    expect(form?.get('file')).toBeInstanceOf(File)
  })

  // Scenario: a tenant upload invalidates the per-tenant cache key ['tenants', tenant].
  it('invalidates ["tenants", tenant] after a tenant upload', async () => {
    mockPostForm.mockResolvedValueOnce(uploadResult)
    const { invalidate, Wrap } = clientWithSpy()
    const { result } = renderHook(() => useTenantUpload(), { wrapper: Wrap })
    const file = new File(['data'], 'file.png', { type: 'image/png' })
    await act(async () => {
      await result.current.mutateAsync({ tenant: 'alpha', file })
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tenants', 'alpha'] })
  })

  // Scenario: clearing a tenant invalidates the per-tenant cache key.
  it('invalidates ["tenants", tenant] after a tenant clear', async () => {
    mockDelete.mockResolvedValueOnce({ deleted: 1, keys: ['a'] })
    const { invalidate, Wrap } = clientWithSpy()
    const { result } = renderHook(() => useTenantClear(), { wrapper: Wrap })
    await act(async () => {
      await result.current.mutateAsync('beta')
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tenants', 'beta'] })
  })

  // Scenario: the tenants list reads its seeded value from the exact ['tenants'] key.
  it('reads the tenants list from its exact query key without refetching', () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    const data = { tenants: ['alpha', 'beta'] }
    qc.setQueryData(['tenants'], data)
    const Wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useTenantsList(), { wrapper: Wrap })
    expect(result.current.data).toEqual(data)
    expect(mockGet).not.toHaveBeenCalled()
  })

  // Scenario: tenant objects read from the exact ['tenants', tenant, 'objects'] key.
  it('reads tenant objects from their exact query key without refetching', () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    const data = { objects: [], prefix: 'alpha/' }
    qc.setQueryData(['tenants', 'alpha', 'objects'], data)
    const Wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useTenantObjects('alpha'), { wrapper: Wrap })
    expect(result.current.data).toEqual(data)
    expect(mockGet).not.toHaveBeenCalled()
  })
})
