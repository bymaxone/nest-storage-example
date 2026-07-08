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

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('useStorageConfig', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())

  it('fetches /system/config', async () => {
    const config = {
      provider: 'minio',
      bucket: 'vault',
      multipartThreshold: 5242880,
      scannerMode: 'pre-upload',
      rejectOnUnknown: false,
    }
    mockGet.mockResolvedValueOnce(config)
    const { result } = renderHook(() => useStorageConfig(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/system/config')
    expect(result.current.data).toEqual(config)
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
    const status = { versioned: true, bucket: 'vault-versioned', status: 'Enabled' }
    mockGet.mockResolvedValueOnce(status)
    const { result } = renderHook(() => useVersioningStatus(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/system/versioning')
    expect(result.current.data).toEqual(status)
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

  // Scenario: config reads from the exact ['system','config'] key without refetching.
  it('reads storage config from its exact query key without refetching', () => {
    const config = {
      provider: 'minio',
      bucket: 'vault',
      multipartThreshold: 1,
      scannerMode: 'pre-upload',
      rejectOnUnknown: false,
    }
    const Wrap = seededClient(['system', 'config'], config)
    const { result } = renderHook(() => useStorageConfig(), { wrapper: Wrap })
    expect(result.current.data).toEqual(config)
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
    const status = { versioned: true, bucket: 'vault-versioned', status: 'Enabled' }
    const Wrap = seededClient(['system', 'versioning'], status)
    const { result } = renderHook(() => useVersioningStatus(), { wrapper: Wrap })
    expect(result.current.data).toEqual(status)
    expect(mockGet).not.toHaveBeenCalled()
  })
})
