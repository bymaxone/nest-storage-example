/**
 * @fileoverview Unit tests for the validation lab upload mutation hook.
 * @layer hooks/use-validation.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useValidationUpload } from './use-validation'

vi.mock('@/lib/api-client', () => ({
  apiPostForm: vi.fn(),
}))

import { apiPostForm } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

const uploadResult = {
  key: 'uploads/file.pdf',
  bucket: 'vault',
  etag: '"abc"',
  contentType: 'application/pdf',
  publicUrl: 'http://localhost:9000/vault/uploads/file.pdf',
  multipart: false,
  fromIdempotencyCache: false,
}

function makeFile(): File {
  return new File(['data'], 'file.pdf', { type: 'application/pdf' })
}

describe('useValidationUpload', () => {
  const mockPostForm = vi.mocked(apiPostForm)
  beforeEach(() => mockPostForm.mockReset())

  it('posts FormData to /validation/upload?path=mime', async () => {
    mockPostForm.mockResolvedValueOnce(uploadResult)
    const { result } = renderHook(() => useValidationUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({ file: makeFile(), path: 'mime' })
    })
    expect(mockPostForm).toHaveBeenCalledWith('/validation/upload?path=mime', expect.any(FormData))
  })

  it('posts to /validation/upload?path=size', async () => {
    mockPostForm.mockResolvedValueOnce(uploadResult)
    const { result } = renderHook(() => useValidationUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({ file: makeFile(), path: 'size' })
    })
    expect(mockPostForm).toHaveBeenCalledWith('/validation/upload?path=size', expect.any(FormData))
  })

  it('posts to /validation/upload?path=magic', async () => {
    mockPostForm.mockResolvedValueOnce(uploadResult)
    const { result } = renderHook(() => useValidationUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({ file: makeFile(), path: 'magic' })
    })
    expect(mockPostForm).toHaveBeenCalledWith('/validation/upload?path=magic', expect.any(FormData))
  })

  // Scenario: the upload appends the file under the exact 'file' field.
  it('appends the file under the "file" field', async () => {
    let form: FormData | undefined
    mockPostForm.mockImplementation((_p: string, f: FormData) => {
      form = f
      return Promise.resolve(uploadResult)
    })
    const { result } = renderHook(() => useValidationUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync({ file: makeFile(), path: 'mime' })
    })
    expect(form?.get('file')).toBeInstanceOf(File)
  })

  // Scenario: a successful validation upload invalidates the exact ['vault'] key.
  it('invalidates ["vault"] after a validation upload', async () => {
    mockPostForm.mockResolvedValueOnce(uploadResult)
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const Wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useValidationUpload(), { wrapper: Wrap })
    await act(async () => {
      await result.current.mutateAsync({ file: makeFile(), path: 'mime' })
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['vault'] })
  })
})
