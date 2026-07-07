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
