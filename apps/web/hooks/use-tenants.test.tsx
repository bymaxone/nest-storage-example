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
  apiPost: vi.fn(),
}))

import { apiGet, apiDelete, apiPost } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

const uploadResponse = {
  tenant: 'alpha',
  key: 'alpha/files/uuid.png',
  fullKey: 'storage-example/alpha/files/uuid.png',
  result: {
    key: 'storage-example/alpha/files/uuid.png',
    bucket: 'vault',
    etag: '"abc"',
    contentType: 'text/plain',
    publicUrl: 'http://localhost:9000/vault/storage-example/alpha/files/uuid.png',
    multipart: false,
    fromIdempotencyCache: false,
  },
}

function makeFile(name = 'file.png') {
  return new File(['data'], name, { type: 'image/png' })
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
  const mockPost = vi.mocked(apiPost)
  beforeEach(() => mockPost.mockReset())

  it('posts a JSON body to /tenants/:tenant/upload', async () => {
    let capturedBody: unknown
    mockPost.mockImplementation((_path: string, body?: unknown) => {
      capturedBody = body
      return Promise.resolve(uploadResponse)
    })
    const { result } = renderHook(() => useTenantUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({ tenant: 'alpha', file: makeFile() })
    })
    expect(mockPost).toHaveBeenCalledWith('/tenants/alpha/upload', expect.any(Object))
    // The dropped file's text becomes `content`; its extension is derived as a slug.
    expect(capturedBody).toEqual({ category: 'files', content: 'data', extension: 'png' })
  })

  // Scenario: a file with no dot in its name has no extension to derive, so the
  // hook must send the safe `'txt'` fallback rather than an empty slug.
  it('falls back to a safe extension for files without a valid extension', async () => {
    let capturedBody: { extension?: string } | undefined
    mockPost.mockImplementation((_path: string, body?: unknown) => {
      capturedBody = body as { extension?: string }
      return Promise.resolve(uploadResponse)
    })
    const { result } = renderHook(() => useTenantUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({ tenant: 'alpha', file: makeFile('noext') })
    })
    expect(capturedBody?.extension).toBe('txt')
  })

  it('falls back to placeholder content for an empty file', async () => {
    let capturedBody: { content?: string } | undefined
    mockPost.mockImplementation((_path: string, body?: unknown) => {
      capturedBody = body as { content?: string }
      return Promise.resolve(uploadResponse)
    })
    const { result } = renderHook(() => useTenantUpload(), { wrapper: wrapper() })
    const emptyFile = new File([], 'blank.txt', { type: 'text/plain' })
    await act(async () => {
      await result.current.mutateAsync({ tenant: 'alpha', file: emptyFile })
    })
    // An empty body would be rejected by the endpoint's min(1) rule, so the hook
    // substitutes a non-empty placeholder derived from the file name.
    expect(capturedBody?.content).toBe('demo upload blank.txt')
  })

  // Scenario: the endpoint caps the text body at 64 KiB, so an oversized file is
  // truncated to exactly the byte limit before it is sent.
  it('truncates the content to the 64 KiB limit', async () => {
    let capturedBody: { content?: string } | undefined
    mockPost.mockImplementation((_path: string, body?: unknown) => {
      capturedBody = body as { content?: string }
      return Promise.resolve(uploadResponse)
    })
    const { result } = renderHook(() => useTenantUpload(), { wrapper: wrapper() })
    const bigFile = new File(['a'.repeat(70_000)], 'big.txt', { type: 'text/plain' })
    await act(async () => {
      await result.current.mutateAsync({ tenant: 'alpha', file: bigFile })
    })
    expect(capturedBody?.content).toHaveLength(65_536)
  })

  // Scenario: a non-alphanumeric character before the extension makes it fail the
  // slug pattern, so the hook must reject it and fall back to `'txt'`.
  it('rejects a non-slug extension with leading junk, falling back to txt', async () => {
    let capturedBody: { extension?: string } | undefined
    mockPost.mockImplementation((_path: string, body?: unknown) => {
      capturedBody = body as { extension?: string }
      return Promise.resolve(uploadResponse)
    })
    const { result } = renderHook(() => useTenantUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({ tenant: 'alpha', file: makeFile('weird.!pdf') })
    })
    expect(capturedBody?.extension).toBe('txt')
  })

  // Scenario: a non-alphanumeric character after the extension also breaks the
  // slug pattern, guarding the trailing-junk branch alongside the leading one.
  it('rejects a non-slug extension with trailing junk, falling back to txt', async () => {
    let capturedBody: { extension?: string } | undefined
    mockPost.mockImplementation((_path: string, body?: unknown) => {
      capturedBody = body as { extension?: string }
      return Promise.resolve(uploadResponse)
    })
    const { result } = renderHook(() => useTenantUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({ tenant: 'alpha', file: makeFile('weird.pdf!') })
    })
    expect(capturedBody?.extension).toBe('txt')
  })

  it('encodes special characters in tenant name', async () => {
    mockPost.mockResolvedValueOnce(uploadResponse)
    const { result } = renderHook(() => useTenantUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({ tenant: 'tenant/a', file: makeFile() })
    })
    expect(mockPost).toHaveBeenCalledWith('/tenants/tenant%2Fa/upload', expect.any(Object))
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

describe('tenant cache invalidation and query keys', () => {
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

  // Scenario: a tenant upload invalidates the per-tenant cache key ['tenants', tenant].
  it('invalidates ["tenants", tenant] after a tenant upload', async () => {
    mockPost.mockResolvedValueOnce(uploadResponse)
    const { invalidate, Wrap } = clientWithSpy()
    const { result } = renderHook(() => useTenantUpload(), { wrapper: Wrap })
    await act(async () => {
      await result.current.mutateAsync({ tenant: 'alpha', file: makeFile() })
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
