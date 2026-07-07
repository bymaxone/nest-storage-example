/**
 * @fileoverview TanStack Query mutations for all upload strategies: single-shot,
 * multer multipart, streaming, idempotent, and SSE override.
 * @layer hooks/use-uploads
 */
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPostForm } from '@/lib/api-client'
import type { UploadResult } from '@bymax-one/nest-storage/shared'

/** Upload progress snapshot from the session store. */
export interface ProgressSnapshot {
  loaded: number
  total: number
  part: number
  strategy: 'single' | 'multipart' | 'stream'
}

/** Parameters for a single-shot form upload. */
export interface SingleUploadParams {
  file: File
  category?: string
  contentType?: string
}

/** Parameters for an idempotent upload. */
export interface IdempotentUploadParams {
  idempotencyKey: string
  category?: string
  contentType?: string
  file: File
}

/** Parameters for an SSE-override upload. */
export interface SseUploadParams {
  file: File
  sse: 'AES256' | 'NONE'
}

/**
 * Mutation to upload a file using the single-shot strategy.
 *
 * @returns TanStack mutation that calls POST /uploads/single.
 */
export function useSingleUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, category, contentType }: SingleUploadParams) => {
      const form = new FormData()
      form.append('file', file)
      if (category) form.append('category', category)
      if (contentType) form.append('contentType', contentType)
      return apiPostForm<UploadResult>('/uploads/single', form)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault'] }),
  })
}

/**
 * Mutation to upload a file using the multer-buffered multipart strategy.
 *
 * @returns TanStack mutation that calls POST /uploads/multipart.
 */
export function useMultipartUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return apiPostForm<UploadResult>('/uploads/multipart', form)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault'] }),
  })
}

/**
 * Fetches the progress snapshot for an upload session.
 *
 * @param sessionId - The session ID or null to skip.
 * @returns TanStack Query result with the ProgressSnapshot.
 */
export function useUploadSession(sessionId: string | null) {
  return useQuery({
    queryKey: ['uploads', 'session', sessionId],
    // `enabled: sessionId !== null` guards execution, so `sessionId` is non-null here.
    queryFn: () => apiGet<ProgressSnapshot>(`/uploads/sessions/${sessionId!}`),
    enabled: sessionId !== null,
    refetchInterval: 500,
  })
}

/**
 * Mutation to upload a file with an idempotency key for deduplication.
 *
 * @returns TanStack mutation that calls POST /uploads/idempotent.
 */
export function useIdempotentUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, idempotencyKey, category, contentType }: IdempotentUploadParams) => {
      const form = new FormData()
      form.append('file', file)
      form.append('idempotencyKey', idempotencyKey)
      if (category) form.append('category', category)
      if (contentType) form.append('contentType', contentType)
      return apiPostForm<UploadResult>('/uploads/idempotent', form)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault'] }),
  })
}

/**
 * Mutation to upload with a per-call SSE override (AES256 or NONE sentinel).
 *
 * @returns TanStack mutation that calls POST /uploads/sse-override.
 */
export function useSseOverrideUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, sse }: SseUploadParams) => {
      const form = new FormData()
      form.append('file', file)
      form.append('sse', sse)
      return apiPostForm<UploadResult>('/uploads/sse-override', form)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault'] }),
  })
}
