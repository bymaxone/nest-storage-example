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
  apiPost: vi.fn(),
  apiPostForm: vi.fn(),
}))

import { apiGet, apiPost, apiPostForm } from '@/lib/api-client'

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
      await result.current.mutateAsync({ file: makeFile(), category: 'attachments' })
    })
    expect(mockPostForm).toHaveBeenCalledWith('/uploads/single', expect.any(FormData))
  })

  it('appends the required category', async () => {
    const { result } = renderHook(() => useSingleUpload(), { wrapper: wrapper() })
    let capturedForm: FormData | undefined
    mockPostForm.mockImplementation((_path: string, form: FormData) => {
      capturedForm = form
      return Promise.resolve(uploadResult)
    })
    await act(async () => {
      await result.current.mutateAsync({ file: makeFile(), category: 'avatars' })
    })
    expect(capturedForm?.get('category')).toBe('avatars')
  })

  it('appends contentType when provided', async () => {
    const { result } = renderHook(() => useSingleUpload(), { wrapper: wrapper() })
    let capturedForm: FormData | undefined
    mockPostForm.mockImplementation((_path: string, form: FormData) => {
      capturedForm = form
      return Promise.resolve(uploadResult)
    })
    await act(async () => {
      await result.current.mutateAsync({
        file: makeFile(),
        category: 'attachments',
        contentType: 'image/png',
      })
    })
    expect(capturedForm?.get('contentType')).toBe('image/png')
  })

  it('omits contentType when not provided', async () => {
    const { result } = renderHook(() => useSingleUpload(), { wrapper: wrapper() })
    let capturedForm: FormData | undefined
    mockPostForm.mockImplementation((_path: string, form: FormData) => {
      capturedForm = form
      return Promise.resolve(uploadResult)
    })
    await act(async () => {
      await result.current.mutateAsync({ file: makeFile(), category: 'media' })
    })
    expect(capturedForm?.get('contentType')).toBeNull()
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
  const mockPost = vi.mocked(apiPost)
  beforeEach(() => mockPost.mockReset())

  it('posts a JSON body to /uploads/idempotent and unwraps the result', async () => {
    let capturedBody: unknown
    mockPost.mockImplementation((_path: string, body?: unknown) => {
      capturedBody = body
      return Promise.resolve({ result: uploadResult, note: 'per-instance cache' })
    })
    const { result } = renderHook(() => useIdempotentUpload(), { wrapper: wrapper() })
    let resolved: unknown
    await act(async () => {
      resolved = await result.current.mutateAsync({
        idempotencyKey: 'key-123',
        content: 'hello',
        contentType: 'text/plain',
      })
    })
    expect(mockPost).toHaveBeenCalledWith('/uploads/idempotent', expect.any(Object))
    expect(capturedBody).toEqual({
      idempotencyKey: 'key-123',
      content: 'hello',
      contentType: 'text/plain',
    })
    // The hook unwraps the { result, note } envelope to the bare UploadResult.
    expect(resolved).toEqual(uploadResult)
  })
})

describe('useSseOverrideUpload', () => {
  const mockPostForm = vi.mocked(apiPostForm)
  beforeEach(() => mockPostForm.mockReset())

  it('posts FormData with the serverSideEncryption field to /uploads/sse-override', async () => {
    let capturedForm: FormData | undefined
    mockPostForm.mockImplementation((_path: string, form: FormData) => {
      capturedForm = form
      return Promise.resolve(uploadResult)
    })
    const { result } = renderHook(() => useSseOverrideUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({
        file: makeFile(),
        category: 'attachments',
        serverSideEncryption: 'AES256',
      })
    })
    expect(mockPostForm).toHaveBeenCalledWith('/uploads/sse-override', expect.any(FormData))
    expect(capturedForm?.get('serverSideEncryption')).toBe('AES256')
    expect(capturedForm?.get('category')).toBe('attachments')
  })

  it('supports the NONE sentinel value', async () => {
    let capturedForm: FormData | undefined
    mockPostForm.mockImplementation((_path: string, form: FormData) => {
      capturedForm = form
      return Promise.resolve(uploadResult)
    })
    const { result } = renderHook(() => useSseOverrideUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({
        file: makeFile(),
        category: 'media',
        serverSideEncryption: 'NONE',
      })
    })
    expect(capturedForm?.get('serverSideEncryption')).toBe('NONE')
  })
})

describe('upload form fields, cache invalidation, and query keys', () => {
  const mockPost = vi.mocked(apiPost)
  const mockPostForm = vi.mocked(apiPostForm)
  const mockGet = vi.mocked(apiGet)
  beforeEach(() => {
    mockPost.mockReset()
    mockPostForm.mockReset()
    mockGet.mockReset()
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

  function captureForm() {
    let form: FormData | undefined
    mockPostForm.mockImplementation((_p: string, f: FormData) => {
      form = f
      return Promise.resolve(uploadResult)
    })
    return () => form
  }

  // Scenario: the single upload appends the raw file under the exact 'file' field.
  it('appends the file under the "file" field for single upload', async () => {
    const getForm = captureForm()
    const { Wrap } = clientWithSpy()
    const { result } = renderHook(() => useSingleUpload(), { wrapper: Wrap })
    await act(async () => {
      await result.current.mutateAsync({ file: makeFile(), category: 'attachments' })
    })
    expect(getForm()?.get('file')).toBeInstanceOf(File)
  })

  // Scenario: multipart and sse uploads carry the file field.
  it('appends the file field for multipart and sse uploads', async () => {
    const getMultipart = captureForm()
    const { Wrap } = clientWithSpy()
    const multipart = renderHook(() => useMultipartUpload(), { wrapper: Wrap })
    await act(async () => {
      await multipart.result.current.mutateAsync(makeFile())
    })
    expect(getMultipart()?.get('file')).toBeInstanceOf(File)

    const getSse = captureForm()
    const sse = renderHook(() => useSseOverrideUpload(), { wrapper: Wrap })
    await act(async () => {
      await sse.result.current.mutateAsync({
        file: makeFile(),
        category: 'attachments',
        serverSideEncryption: 'AES256',
      })
    })
    expect(getSse()?.get('file')).toBeInstanceOf(File)
  })

  // Scenario: a successful single upload invalidates the exact ['vault'] cache key.
  it('invalidates ["vault"] after a single upload', async () => {
    captureForm()
    const { invalidate, Wrap } = clientWithSpy()
    const { result } = renderHook(() => useSingleUpload(), { wrapper: Wrap })
    await act(async () => {
      await result.current.mutateAsync({ file: makeFile(), category: 'attachments' })
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['vault'] })
  })

  // Scenario: a successful multipart upload invalidates the exact ['vault'] key.
  it('invalidates ["vault"] after a multipart upload', async () => {
    captureForm()
    const { invalidate, Wrap } = clientWithSpy()
    const { result } = renderHook(() => useMultipartUpload(), { wrapper: Wrap })
    await act(async () => {
      await result.current.mutateAsync(makeFile())
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['vault'] })
  })

  // Scenario: a successful idempotent upload invalidates the exact ['vault'] key.
  it('invalidates ["vault"] after an idempotent upload', async () => {
    mockPost.mockResolvedValue({ result: uploadResult, note: 'n' })
    const { invalidate, Wrap } = clientWithSpy()
    const { result } = renderHook(() => useIdempotentUpload(), { wrapper: Wrap })
    await act(async () => {
      await result.current.mutateAsync({
        idempotencyKey: 'k',
        content: 'c',
        contentType: 'text/plain',
      })
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['vault'] })
  })

  // Scenario: a successful sse-override upload invalidates the exact ['vault'] key.
  it('invalidates ["vault"] after an sse-override upload', async () => {
    captureForm()
    const { invalidate, Wrap } = clientWithSpy()
    const { result } = renderHook(() => useSseOverrideUpload(), { wrapper: Wrap })
    await act(async () => {
      await result.current.mutateAsync({
        file: makeFile(),
        category: 'attachments',
        serverSideEncryption: 'AES256',
      })
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['vault'] })
  })

  // Scenario: the session query reads its seeded value from the exact key
  // ['uploads','session',id] without hitting the network — a wrong key would miss.
  it('reads the session snapshot from its exact query key without refetching', () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    const snapshot = { loaded: 1, total: 2, part: 1, strategy: 'single' as const }
    qc.setQueryData(['uploads', 'session', 'sess-xyz'], snapshot)
    const Wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useUploadSession('sess-xyz'), { wrapper: Wrap })
    expect(result.current.data).toEqual(snapshot)
    expect(mockGet).not.toHaveBeenCalled()
  })
})
