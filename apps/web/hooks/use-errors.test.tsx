/**
 * @fileoverview Unit tests for error explorer hooks.
 * @layer hooks/use-errors.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useErrorCatalogue, useTriggerError, ERROR_CATALOGUE_KEY } from './use-errors'
import { StorageApiError } from '@/lib/api-client'

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>()
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
  }
})

import { apiGet, apiPost } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('ERROR_CATALOGUE_KEY', () => {
  it('is ["errors", "catalogue"]', () => {
    expect(ERROR_CATALOGUE_KEY).toEqual(['errors', 'catalogue'])
  })
})

describe('useErrorCatalogue', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())

  it('fetches /errors', async () => {
    const entries = [
      { code: 'STORAGE_OBJECT_NOT_FOUND', trigger: 'delete missing key', description: '...' },
    ]
    mockGet.mockResolvedValueOnce(entries)
    const { result } = renderHook(() => useErrorCatalogue(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/errors')
    expect(result.current.data).toEqual(entries)
  })
})

describe('useTriggerError', () => {
  const mockPost = vi.mocked(apiPost)
  beforeEach(() => mockPost.mockReset())

  it('posts to /errors/:code', async () => {
    mockPost.mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useTriggerError(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync('STORAGE_OBJECT_NOT_FOUND')
    })
    expect(mockPost).toHaveBeenCalledWith('/errors/STORAGE_OBJECT_NOT_FOUND')
  })

  it('returns a TriggeredError snapshot when apiPost throws StorageApiError', async () => {
    const err = new StorageApiError('STORAGE_OBJECT_NOT_FOUND', 'not found', 404, { key: 'x' })
    mockPost.mockRejectedValueOnce(err)
    const { result } = renderHook(() => useTriggerError(), { wrapper: wrapper() })
    let captured: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      captured = await result.current.mutateAsync('STORAGE_OBJECT_NOT_FOUND')
    })
    expect(captured?.code).toBe('STORAGE_OBJECT_NOT_FOUND')
    expect(captured?.message).toBe('not found')
    expect(captured?.status).toBe(404)
    expect(captured?.details).toEqual({ key: 'x' })
  })

  it('returns no-error snapshot when apiPost resolves without throwing', async () => {
    mockPost.mockResolvedValueOnce({ data: 'unexpected success' })
    const { result } = renderHook(() => useTriggerError(), { wrapper: wrapper() })
    let captured: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      captured = await result.current.mutateAsync('STORAGE_TIMEOUT')
    })
    expect(captured?.code).toBe('UNKNOWN')
    expect(captured?.message).toBe('No error thrown')
    expect(captured?.status).toBe(200)
    expect(captured?.details).toBeUndefined()
  })

  it('maps a generic Error (e.g. a network TypeError) to a safe UNKNOWN snapshot', async () => {
    // Scenario: fetch itself rejects with a plain Error rather than a StorageApiError.
    // Rule it protects: the snapshot stays well-formed — UNKNOWN code, status 0, the
    // Error's message preserved — so the TriggeredError contract never carries undefined.
    const plainErr = new Error('network down')
    mockPost.mockRejectedValueOnce(plainErr)
    const { result } = renderHook(() => useTriggerError(), { wrapper: wrapper() })
    let captured: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      captured = await result.current.mutateAsync('STORAGE_TIMEOUT')
    })
    expect(captured?.code).toBe('UNKNOWN')
    expect(captured?.message).toBe('network down')
    expect(captured?.status).toBe(0)
    expect(captured?.details).toBeUndefined()
  })

  it('maps a non-Error thrown value to the "Unknown error" fallback message', async () => {
    // Scenario: a non-Error value is thrown (a string), the pathological worst case.
    // Rule it protects: the else branch of the message guard produces a stable label
    // instead of leaking a raw stringified value or throwing again.
    mockPost.mockRejectedValueOnce('boom')
    const { result } = renderHook(() => useTriggerError(), { wrapper: wrapper() })
    let captured: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      captured = await result.current.mutateAsync('STORAGE_TIMEOUT')
    })
    expect(captured?.code).toBe('UNKNOWN')
    expect(captured?.message).toBe('Unknown error')
    expect(captured?.status).toBe(0)
  })
})
