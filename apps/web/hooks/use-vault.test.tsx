/**
 * @fileoverview Unit tests for vault object list, metadata, and mutation hooks.
 * @layer hooks/use-vault.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  vaultListKey,
  useVaultList,
  useObjectMeta,
  useDeleteObject,
  useBulkDelete,
  useCopyObject,
  usePublicUrl,
} from './use-vault'

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}))

import { apiGet, apiPost, apiDelete } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('vaultListKey', () => {
  it('returns correct key tuple for empty params', () => {
    expect(vaultListKey({})).toEqual(['vault', 'list', {}])
  })

  it('includes params in key', () => {
    const params = { prefix: 'docs/', maxKeys: 20 }
    expect(vaultListKey(params)).toEqual(['vault', 'list', params])
  })
})

describe('useVaultList', () => {
  const mockGet = vi.mocked(apiGet)
  const page = { objects: [], commonPrefixes: [], truncated: false }

  beforeEach(() => mockGet.mockReset())

  it('calls apiGet with /vault when no params given', async () => {
    mockGet.mockResolvedValueOnce(page)
    const { result } = renderHook(() => useVaultList({}), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/vault')
  })

  it('appends prefix query param', async () => {
    mockGet.mockResolvedValueOnce(page)
    const { result } = renderHook(() => useVaultList({ prefix: 'docs/' }), {
      wrapper: wrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('prefix=docs%2F'))
  })

  it('appends maxKeys query param', async () => {
    mockGet.mockResolvedValueOnce(page)
    const { result } = renderHook(() => useVaultList({ maxKeys: 50 }), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('maxKeys=50'))
  })

  it('appends cursor query param', async () => {
    mockGet.mockResolvedValueOnce(page)
    const { result } = renderHook(() => useVaultList({ cursor: 'tok123' }), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('cursor=tok123'))
  })

  it('appends delimiter query param', async () => {
    mockGet.mockResolvedValueOnce(page)
    const { result } = renderHook(() => useVaultList({ delimiter: '/' }), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('delimiter=%2F'))
  })
})

describe('useObjectMeta', () => {
  const mockGet = vi.mocked(apiGet)

  beforeEach(() => mockGet.mockReset())

  it('is disabled when key is null', () => {
    const { result } = renderHook(() => useObjectMeta(null), { wrapper: wrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('fetches /vault/object?key= when key is provided', async () => {
    const meta = {
      key: 'docs/file.pdf',
      bucket: 'vault',
      size: 1024,
      contentType: 'application/pdf',
      etag: '"abc"',
      lastModified: new Date().toISOString(),
      metadata: {},
    }
    mockGet.mockResolvedValueOnce(meta)
    const { result } = renderHook(() => useObjectMeta('docs/file.pdf'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('key=docs%2Ffile.pdf'))
  })
})

describe('useDeleteObject', () => {
  const mockDelete = vi.mocked(apiDelete)

  beforeEach(() => mockDelete.mockReset())

  it('calls apiDelete with encoded key', async () => {
    mockDelete.mockResolvedValueOnce({ deleted: true })
    const { result } = renderHook(() => useDeleteObject(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync('docs/file.pdf')
    })
    expect(mockDelete).toHaveBeenCalledWith(expect.stringContaining('key=docs%2Ffile.pdf'))
  })
})

describe('useBulkDelete', () => {
  const mockPost = vi.mocked(apiPost)

  beforeEach(() => mockPost.mockReset())

  it('calls apiPost /vault/bulk-delete with keys array', async () => {
    mockPost.mockResolvedValueOnce({ deleted: ['a', 'b'], failed: [] })
    const { result } = renderHook(() => useBulkDelete(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync(['a', 'b'])
    })
    expect(mockPost).toHaveBeenCalledWith('/vault/bulk-delete', { keys: ['a', 'b'] })
  })
})

describe('useCopyObject', () => {
  const mockPost = vi.mocked(apiPost)

  beforeEach(() => mockPost.mockReset())

  it('calls apiPost /vault/copy with copy params', async () => {
    mockPost.mockResolvedValueOnce({
      etag: '"x"',
      sourceKey: 'a',
      destinationKey: 'b',
      bucket: 'vault',
    })
    const { result } = renderHook(() => useCopyObject(), { wrapper: wrapper() })
    const params = { sourceKey: 'a', destinationKey: 'b' }
    await act(async () => {
      await result.current.mutateAsync(params)
    })
    expect(mockPost).toHaveBeenCalledWith('/vault/copy', params)
  })
})

describe('usePublicUrl', () => {
  const mockGet = vi.mocked(apiGet)

  beforeEach(() => mockGet.mockReset())

  it('is disabled when key is null', () => {
    const { result } = renderHook(() => usePublicUrl(null), { wrapper: wrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('fetches /vault/object/public-url?key= when key is provided', async () => {
    mockGet.mockResolvedValueOnce({ publicUrl: 'https://cdn.example.com/file.pdf' })
    const { result } = renderHook(() => usePublicUrl('docs/file.pdf'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/vault/object/public-url?key='))
  })
})

describe('vault cache invalidation and query keys', () => {
  const mockGet = vi.mocked(apiGet)
  const mockPost = vi.mocked(apiPost)
  const mockDelete = vi.mocked(apiDelete)
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
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

  // Scenario: deleting an object invalidates the exact ['vault'] cache key.
  it('invalidates ["vault"] after a delete', async () => {
    mockDelete.mockResolvedValueOnce({ deleted: true })
    const { invalidate, Wrap } = clientWithSpy()
    const { result } = renderHook(() => useDeleteObject(), { wrapper: Wrap })
    await act(async () => {
      await result.current.mutateAsync('docs/a.pdf')
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['vault'] })
  })

  // Scenario: a bulk delete invalidates the exact ['vault'] cache key.
  it('invalidates ["vault"] after a bulk delete', async () => {
    mockPost.mockResolvedValueOnce({ deleted: ['a'], failed: [] })
    const { invalidate, Wrap } = clientWithSpy()
    const { result } = renderHook(() => useBulkDelete(), { wrapper: Wrap })
    await act(async () => {
      await result.current.mutateAsync(['a'])
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['vault'] })
  })

  // Scenario: a server-side copy invalidates the exact ['vault'] cache key.
  it('invalidates ["vault"] after a copy', async () => {
    mockPost.mockResolvedValueOnce({
      etag: '"x"',
      sourceKey: 'a',
      destinationKey: 'b',
      bucket: 'vault',
    })
    const { invalidate, Wrap } = clientWithSpy()
    const { result } = renderHook(() => useCopyObject(), { wrapper: Wrap })
    await act(async () => {
      await result.current.mutateAsync({ sourceKey: 'a', destinationKey: 'b' })
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['vault'] })
  })

  // Scenario: useObjectMeta reads its seeded value from the exact key
  // ['vault','meta',key] without refetching; a wrong key would miss and fetch.
  it('reads object metadata from its exact query key without refetching', () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    const meta = {
      key: 'docs/a.pdf',
      bucket: 'vault',
      size: 1,
      contentType: 'application/pdf',
      etag: '"e"',
      lastModified: new Date().toISOString(),
      metadata: {},
    }
    qc.setQueryData(['vault', 'meta', 'docs/a.pdf'], meta)
    const Wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useObjectMeta('docs/a.pdf'), { wrapper: Wrap })
    expect(result.current.data).toEqual(meta)
    expect(mockGet).not.toHaveBeenCalled()
  })

  // Scenario: usePublicUrl reads its seeded value from the exact key
  // ['vault','public-url',key] without refetching.
  it('reads the public url from its exact query key without refetching', () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    const data = { publicUrl: 'https://cdn.example.com/a.pdf' }
    qc.setQueryData(['vault', 'public-url', 'docs/a.pdf'], data)
    const Wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => usePublicUrl('docs/a.pdf'), { wrapper: Wrap })
    expect(result.current.data).toEqual(data)
    expect(mockGet).not.toHaveBeenCalled()
  })
})
