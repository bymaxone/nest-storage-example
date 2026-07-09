/**
 * @fileoverview Unit tests for presigned URL mutation hooks.
 * @layer hooks/use-signed.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useSignedDownloadUrl,
  useSignedUploadUrl,
  useSignedMultipartUrls,
  useConfirmUpload,
} from './use-signed'

vi.mock('@/lib/api-client', () => ({
  apiPost: vi.fn(),
}))

import { apiPost } from '@/lib/api-client'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrap({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('useSignedDownloadUrl', () => {
  const mockPost = vi.mocked(apiPost)
  beforeEach(() => mockPost.mockReset())

  it('posts to /signed/download-url with params', async () => {
    mockPost.mockResolvedValueOnce({
      url: 'https://s3.example.com/key?sig=x',
      method: 'GET' as const,
      requiredHeaders: {},
      expiresAt: new Date().toISOString(),
      requestedTtlSeconds: 300,
      effectiveTtlSeconds: 300,
      clamped: false,
      maxTtlSeconds: 3600,
    })
    const { result } = renderHook(() => useSignedDownloadUrl(), { wrapper: wrapper() })
    const params = { key: 'docs/file.pdf', ttlSeconds: 300 }
    await act(async () => {
      await result.current.mutateAsync(params)
    })
    expect(mockPost).toHaveBeenCalledWith('/signed/download-url', params)
  })
})

describe('useSignedUploadUrl', () => {
  const mockPost = vi.mocked(apiPost)
  beforeEach(() => mockPost.mockReset())

  it('posts to /signed/upload-url with params', async () => {
    mockPost.mockResolvedValueOnce({
      url: 'https://s3.example.com/new-key?sig=x',
      expiresAt: new Date().toISOString(),
      key: 'attachments/img.png',
      requiredHeaders: { 'Content-Type': 'image/png' },
      method: 'PUT' as const,
      requestedTtlSeconds: 300,
      effectiveTtlSeconds: 300,
      clamped: false,
      maxTtlSeconds: 3600,
    })
    const { result } = renderHook(() => useSignedUploadUrl(), { wrapper: wrapper() })
    const params = { category: 'attachments', contentType: 'image/png' }
    await act(async () => {
      await result.current.mutateAsync(params)
    })
    expect(mockPost).toHaveBeenCalledWith('/signed/upload-url', params)
  })
})

describe('useSignedMultipartUrls', () => {
  const mockPost = vi.mocked(apiPost)
  beforeEach(() => mockPost.mockReset())

  it('posts to /signed/multipart-urls with params', async () => {
    mockPost.mockResolvedValueOnce({
      uploadId: 'uid-abc',
      partUrls: [],
      completeUrl: 'https://s3.example.com/complete?sig=x',
    })
    const { result } = renderHook(() => useSignedMultipartUrls(), { wrapper: wrapper() })
    const params = { key: 'big-file.zip', contentType: 'application/zip', partCount: 3 }
    await act(async () => {
      await result.current.mutateAsync(params)
    })
    expect(mockPost).toHaveBeenCalledWith('/signed/multipart-urls', params)
  })
})

describe('useConfirmUpload', () => {
  const mockPost = vi.mocked(apiPost)
  beforeEach(() => mockPost.mockReset())

  it('posts { key } to /signed/confirm', async () => {
    mockPost.mockResolvedValueOnce({
      confirmed: true,
      key: 'uploads/img.png',
      scan: { status: 'clean' },
    })
    const { result } = renderHook(() => useConfirmUpload(), { wrapper: wrapper() })
    await act(async () => {
      await result.current.mutateAsync('uploads/img.png')
    })
    expect(mockPost).toHaveBeenCalledWith('/signed/confirm', { key: 'uploads/img.png' })
  })
})
