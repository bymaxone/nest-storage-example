/**
 * @fileoverview Unit tests for system page data hooks.
 * @layer hooks/use-system.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useStorageConfig, useProviderRecipes, useVersioningStatus } from './use-system'

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
}))

import { apiGet } from '@/lib/api-client'

/** Raw nested config as returned by GET /system/config. */
const rawConfig = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  bucket: 'vault',
  keyPrefix: 'storage-example',
  signedUrls: { defaultGetTtlSeconds: 300, defaultPutTtlSeconds: 300, maxTtlSeconds: 3600 },
  multipart: { thresholdBytes: 5242880, partSizeBytes: 5242880, queueSize: 4 },
  scanner: { impl: 'MarkerFileScanner', mode: 'pre-upload', rejectOnUnknown: false },
}

/** The flattened shape the config tab consumes after the hook's `select`. */
const flatConfig = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  bucket: 'vault',
  keyPrefix: 'storage-example',
  multipartThreshold: 5242880,
  scannerImpl: 'MarkerFileScanner',
  scannerMode: 'pre-upload',
  rejectOnUnknown: false,
  maxTtlSeconds: 3600,
}

const versioningStatus = {
  buckets: [
    { bucket: 'vault', status: 'Unversioned' },
    { bucket: 'vault-versioned', status: 'Enabled' },
  ],
  tradeOffNote: 'Versioning retains every object generation.',
}

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('useStorageConfig', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())

  it('fetches /system/config and flattens the nested response', async () => {
    mockGet.mockResolvedValueOnce(rawConfig)
    const { result } = renderHook(() => useStorageConfig(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/system/config')
    expect(result.current.data).toEqual(flatConfig)
  })

  it('omits keyPrefix when the API response has none', async () => {
    const withoutPrefix: Record<string, unknown> = { ...rawConfig }
    delete withoutPrefix.keyPrefix
    mockGet.mockResolvedValueOnce(withoutPrefix)
    const { result } = renderHook(() => useStorageConfig(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).not.toHaveProperty('keyPrefix')
  })
})

describe('useProviderRecipes', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())

  it('fetches /system/recipes', async () => {
    const recipes = [
      {
        provider: 'awsS3',
        options: { region: 'us-east-1' },
        quirks: ['ACLs disabled on modern buckets'],
      },
    ]
    mockGet.mockResolvedValueOnce(recipes)
    const { result } = renderHook(() => useProviderRecipes(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/system/recipes')
    expect(result.current.data).toEqual(recipes)
  })
})

describe('useVersioningStatus', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())

  it('fetches /system/versioning', async () => {
    mockGet.mockResolvedValueOnce(versioningStatus)
    const { result } = renderHook(() => useVersioningStatus(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/system/versioning')
    expect(result.current.data).toEqual(versioningStatus)
  })
})

describe('system query keys', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())

  function seededClient(key: readonly unknown[], data: unknown) {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    qc.setQueryData(key as unknown[], data)
    const Wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    return Wrap
  }

  // Scenario: config reads from the exact ['system','config'] key without refetching;
  // the seeded raw payload is still flattened by the hook's select.
  it('reads storage config from its exact query key without refetching', () => {
    const Wrap = seededClient(['system', 'config'], rawConfig)
    const { result } = renderHook(() => useStorageConfig(), { wrapper: Wrap })
    expect(result.current.data).toEqual(flatConfig)
    expect(mockGet).not.toHaveBeenCalled()
  })

  // Scenario: recipes read from the exact ['system','recipes'] key without refetching.
  it('reads provider recipes from their exact query key without refetching', () => {
    const recipes = [{ provider: 'awsS3', options: {}, quirks: [] }]
    const Wrap = seededClient(['system', 'recipes'], recipes)
    const { result } = renderHook(() => useProviderRecipes(), { wrapper: Wrap })
    expect(result.current.data).toEqual(recipes)
    expect(mockGet).not.toHaveBeenCalled()
  })

  // Scenario: versioning reads from the exact ['system','versioning'] key without refetching.
  it('reads versioning status from its exact query key without refetching', () => {
    const Wrap = seededClient(['system', 'versioning'], versioningStatus)
    const { result } = renderHook(() => useVersioningStatus(), { wrapper: Wrap })
    expect(result.current.data).toEqual(versioningStatus)
    expect(mockGet).not.toHaveBeenCalled()
  })
})
