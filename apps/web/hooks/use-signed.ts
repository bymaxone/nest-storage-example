/**
 * @fileoverview TanStack Query mutations for issuing presigned URLs and
 * confirming post-direct-upload objects. Signed URLs are credentials: this
 * module never renders them to the console; callers must copy-to-clipboard.
 * @layer hooks/use-signed
 */
'use client'

import { useMutation } from '@tanstack/react-query'
import { apiPost } from '@/lib/api-client'

/** Response from POST /signed/download-url. */
export interface DownloadUrlResponse {
  url: string
  method: 'GET'
  requiredHeaders: Record<string, string>
  expiresAt: string
  requestedTtlSeconds: number
  effectiveTtlSeconds: number
  clamped: boolean
  maxTtlSeconds: number
}

/** Response from POST /signed/upload-url. */
export interface UploadUrlResponse {
  url: string
  key: string
  requiredHeaders: Record<string, string>
  method: 'PUT'
  expiresAt: string
  requestedTtlSeconds: number
  effectiveTtlSeconds: number
  clamped: boolean
  maxTtlSeconds: number
}

/** One part URL entry from a multipart presign response. */
export interface PartUrl {
  partNumber: number
  url: string
  requiredHeaders: Record<string, string>
}

/** Response from POST /signed/multipart-urls. */
export interface MultipartUrlsResponse {
  uploadId: string
  partUrls: PartUrl[]
  completeUrl: string
}

/** Response from POST /signed/confirm. */
export interface ConfirmResult {
  confirmed: boolean
  key: string
  metadata?: {
    key: string
    bucket: string
    size: number
    contentType: string
    etag: string
    lastModified: string
  }
  scan?: {
    status: string
  }
  checks?: {
    sizeWithinPolicy: boolean
    mimeAllowed: boolean
    scanClean: boolean
  }
  note?: string
}

/** Parameters for issuing a download URL. */
export interface DownloadUrlParams {
  key: string
  ttlSeconds?: number
  responseContentType?: string
  responseContentDisposition?: string
}

/** Parameters for issuing an upload URL. The server composes the object key
 * from `category` + a generated UUID and returns it as `key`. */
export interface UploadUrlParams {
  category: string
  contentType: string
  ttlSeconds?: number
  maxSizeBytes?: number
}

/** Parameters for issuing multipart upload URLs. */
export interface MultipartUrlsParams {
  key: string
  contentType: string
  partCount: number
  ttlSeconds?: number
}

/**
 * Mutation to issue a presigned GET URL for a vault object.
 *
 * @returns TanStack mutation that calls POST /signed/download-url.
 */
export function useSignedDownloadUrl() {
  return useMutation({
    mutationFn: (params: DownloadUrlParams) =>
      apiPost<DownloadUrlResponse>('/signed/download-url', params),
  })
}

/**
 * Mutation to issue a presigned PUT URL for a direct browser upload.
 *
 * @returns TanStack mutation that calls POST /signed/upload-url.
 */
export function useSignedUploadUrl() {
  return useMutation({
    mutationFn: (params: UploadUrlParams) =>
      apiPost<UploadUrlResponse>('/signed/upload-url', params),
  })
}

/**
 * Mutation to issue presigned part URLs for a browser-side multipart upload.
 *
 * @returns TanStack mutation that calls POST /signed/multipart-urls.
 */
export function useSignedMultipartUrls() {
  return useMutation({
    mutationFn: (params: MultipartUrlsParams) =>
      apiPost<MultipartUrlsResponse>('/signed/multipart-urls', params),
  })
}

/**
 * Mutation to confirm a direct upload: head-checks the object and runs the
 * post-upload scan.
 *
 * @returns TanStack mutation that calls POST /signed/confirm.
 */
export function useConfirmUpload() {
  return useMutation({
    mutationFn: (key: string) => apiPost<ConfirmResult>('/signed/confirm', { key }),
  })
}
