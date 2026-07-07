/**
 * @fileoverview Unit tests for the storage health polling hook.
 * @layer hooks/use-health.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useHealth, HEALTH_QUERY_KEY } from './use-health'

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

describe('HEALTH_QUERY_KEY', () => {
  it('is ["health"]', () => {
    expect(HEALTH_QUERY_KEY).toEqual(['health'])
  })
})

describe('useHealth', () => {
  const mockGet = vi.mocked(apiGet)

  beforeEach(() => {
    mockGet.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls apiGet with /health', async () => {
    mockGet.mockResolvedValueOnce({ status: 'up', latencyMs: 12, bucket: 'vault' })
    const { result } = renderHook(() => useHealth(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/health')
  })

  it('returns health data on success', async () => {
    const data = { status: 'up' as const, latencyMs: 5, bucket: 'vault' }
    mockGet.mockResolvedValueOnce(data)
    const { result } = renderHook(() => useHealth(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(data)
  })

  it('reflects error state when apiGet rejects', async () => {
    mockGet.mockRejectedValueOnce(new Error('unreachable'))
    const { result } = renderHook(() => useHealth(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('accepts a custom refetchInterval', async () => {
    mockGet.mockResolvedValue({ status: 'up' as const, latencyMs: 1, bucket: 'vault' })
    const { result } = renderHook(() => useHealth(5_000), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Hook accepted the parameter without throwing; the query ran once.
    expect(mockGet).toHaveBeenCalledTimes(1)
  })
})
