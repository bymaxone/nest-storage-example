/**
 * @fileoverview Unit tests for upload strategy mutation hooks.
 * @layer hooks/use-uploads.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useSingleUpload,
  useMultipartUpload,
  useUploadSession,
  useIdempotentUpload,
  useSseOverrideUpload,
} from './use-uploads'

vi.mock('@/lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPostForm: vi.fn(),
}))

import { apiGet, apiPostForm } from '@/lib/api-client'

const uploadResult = {
  key: 'uploads/file.png',
  bucket: 'vault',
  etag: '"abc"',
  contentType: 'image/png',
  publicUrl: 'http://localhost:9000/vault/uploads/file.png',
  multipart: false,
  fromIdempotencyCache: false,
}

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

function makeFile(name = 'test.png', type = 'image/png'): File {
  return new File(['data'], name, { type })
}

describe('useSingleUpload', () => {
  const mockPostForm = vi.mocked(apiPostForm)
  beforeEach(() => mockPostForm.mockReset())

  it('posts FormData to /uploads/single', async () => {
    mockPostForm.mockResolvedValueOnce(uploadResult)
    const { result } = renderHook(() => useSingleUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({ file: makeFile() })
    })
    expect(mockPostForm).toHaveBeenCalledWith('/uploads/single', expect.any(FormData))
  })

  it('appends category when provided', async () => {
    const { result } = renderHook(() => useSingleUpload(), { wrapper: wrapper() })
    let capturedForm: FormData | undefined
    mockPostForm.mockImplementation((_path: string, form: FormData) => {
      capturedForm = form
      return Promise.resolve(uploadResult)
    })
    await act(async () => {
      await result.current.mutateAsync({ file: makeFile(), category: 'images' })
    })
    expect(capturedForm?.get('category')).toBe('images')
  })

  it('appends contentType when provided', async () => {
    const { result } = renderHook(() => useSingleUpload(), { wrapper: wrapper() })
    let capturedForm: FormData | undefined
    mockPostForm.mockImplementation((_path: string, form: FormData) => {
      capturedForm = form
      return Promise.resolve(uploadResult)
    })
    await act(async () => {
      await result.current.mutateAsync({ file: makeFile(), contentType: 'image/png' })
    })
    expect(capturedForm?.get('contentType')).toBe('image/png')
  })
})

describe('useMultipartUpload', () => {
  const mockPostForm = vi.mocked(apiPostForm)
  beforeEach(() => mockPostForm.mockReset())

  it('posts FormData to /uploads/multipart', async () => {
    mockPostForm.mockResolvedValueOnce({ ...uploadResult, multipart: true })
    const { result } = renderHook(() => useMultipartUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync(makeFile())
    })
    expect(mockPostForm).toHaveBeenCalledWith('/uploads/multipart', expect.any(FormData))
  })
})

describe('useUploadSession', () => {
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => mockGet.mockReset())

  it('is disabled when sessionId is null', () => {
    const { result } = renderHook(() => useUploadSession(null), { wrapper: wrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('fetches /uploads/sessions/:id when sessionId is provided', async () => {
    const snapshot = { loaded: 512, total: 1024, part: 1, strategy: 'multipart' as const }
    mockGet.mockResolvedValueOnce(snapshot)
    const { result } = renderHook(() => useUploadSession('sess-abc'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/uploads/sessions/sess-abc')
  })
})

describe('useIdempotentUpload', () => {
  const mockPostForm = vi.mocked(apiPostForm)
  beforeEach(() => mockPostForm.mockReset())

  it('posts FormData with idempotencyKey to /uploads/idempotent', async () => {
    let capturedForm: FormData | undefined
    mockPostForm.mockImplementation((_path: string, form: FormData) => {
      capturedForm = form
      return Promise.resolve(uploadResult)
    })
    const { result } = renderHook(() => useIdempotentUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({
        file: makeFile(),
        idempotencyKey: 'key-123',
      })
    })
    expect(mockPostForm).toHaveBeenCalledWith('/uploads/idempotent', expect.any(FormData))
    expect(capturedForm?.get('idempotencyKey')).toBe('key-123')
  })

  it('appends optional category and contentType', async () => {
    let capturedForm: FormData | undefined
    mockPostForm.mockImplementation((_path: string, form: FormData) => {
      capturedForm = form
      return Promise.resolve(uploadResult)
    })
    const { result } = renderHook(() => useIdempotentUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({
        file: makeFile(),
        idempotencyKey: 'k',
        category: 'docs',
        contentType: 'application/pdf',
      })
    })
    expect(capturedForm?.get('category')).toBe('docs')
    expect(capturedForm?.get('contentType')).toBe('application/pdf')
  })
})

describe('useSseOverrideUpload', () => {
  const mockPostForm = vi.mocked(apiPostForm)
  beforeEach(() => mockPostForm.mockReset())

  it('posts FormData with sse field to /uploads/sse-override', async () => {
    let capturedForm: FormData | undefined
    mockPostForm.mockImplementation((_path: string, form: FormData) => {
      capturedForm = form
      return Promise.resolve(uploadResult)
    })
    const { result } = renderHook(() => useSseOverrideUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({ file: makeFile(), sse: 'AES256' })
    })
    expect(mockPostForm).toHaveBeenCalledWith('/uploads/sse-override', expect.any(FormData))
    expect(capturedForm?.get('sse')).toBe('AES256')
  })

  it('supports NONE sentinel value', async () => {
    let capturedForm: FormData | undefined
    mockPostForm.mockImplementation((_path: string, form: FormData) => {
      capturedForm = form
      return Promise.resolve(uploadResult)
    })
    const { result } = renderHook(() => useSseOverrideUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({ file: makeFile(), sse: 'NONE' })
    })
    expect(capturedForm?.get('sse')).toBe('NONE')
  })
})
