/**
 * @fileoverview Unit tests for scanner lab hooks.
 * @layer hooks/use-scanner.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useScannerConfig,
  useScannerUpload,
  SCANNER_CONFIG_KEY,
  type ScannerUploadBody,
} from './use-scanner'

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

import { apiGet, apiPost } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('SCANNER_CONFIG_KEY', () => {
  it('is ["scanner", "config"]', () => {
    expect(SCANNER_CONFIG_KEY).toEqual(['scanner', 'config'])
  })
})

describe('useScannerConfig', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())

  it('fetches /scanner/config', async () => {
    const config = { enabled: true, mode: 'pre-upload' as const, rejectOnUnknown: false }
    mockGet.mockResolvedValueOnce(config)
    const { result } = renderHook(() => useScannerConfig(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/scanner/config')
    expect(result.current.data).toEqual(config)
  })
})

describe('useScannerUpload', () => {
  const mockPost = vi.mocked(apiPost)
  beforeEach(() => mockPost.mockReset())

  it('posts JSON body to /scanner/upload', async () => {
    const scanResult = {
      key: 'scanner-lab/demo-clean',
      verdict: { status: 'clean', engine: 'MarkerFileScanner' },
    }
    mockPost.mockResolvedValueOnce(scanResult)
    const { result } = renderHook(() => useScannerUpload(), { wrapper: wrapper() })
    const body: ScannerUploadBody = { content: 'clean content', keySeed: 'demo-clean' }
    await act(async () => {
      await result.current.mutateAsync(body)
    })
    expect(mockPost).toHaveBeenCalledWith('/scanner/upload', body)
  })

  it('returns the scan result with verdict.status', async () => {
    const scanResult = {
      key: 'scanner-lab/X-DEMO-INFECTED--demo-infected',
      verdict: {
        status: 'infected',
        engine: 'MarkerFileScanner',
        threat: 'X-DEMO-INFECTED',
      },
    }
    mockPost.mockResolvedValueOnce(scanResult)
    const { result } = renderHook(() => useScannerUpload(), { wrapper: wrapper() })
    const body: ScannerUploadBody = {
      content: 'X-DEMO-INFECTED This content has the infected marker.',
      keySeed: 'demo-infected',
    }
    let returned:
      | {
          key: string
          verdict: { status: string; engine: string; threat?: string }
          warning?: string
        }
      | undefined
    await act(async () => {
      returned = await result.current.mutateAsync(body)
    })
    expect(returned?.verdict.status).toBe('infected')
    expect(returned?.verdict.threat).toBe('X-DEMO-INFECTED')
  })

  // Scenario: a successful scanner upload invalidates the exact ['vault'] cache key.
  it('invalidates ["vault"] after a scanner upload', async () => {
    mockPost.mockResolvedValueOnce({ key: 'k', verdict: { status: 'clean', engine: 'x' } })
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const Wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useScannerUpload(), { wrapper: Wrap })
    await act(async () => {
      await result.current.mutateAsync({ content: 'clean' })
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['vault'] })
  })
})
