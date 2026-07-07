/**
 * @fileoverview TanStack Query hooks for the scanner lab: uploading through the
 * scan pipeline and reading the active scanner configuration.
 * @layer hooks/use-scanner
 */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'

/** Scanner configuration returned by GET /scanner/config. */
export interface ScannerConfig {
  enabled: boolean
  mode: 'pre-upload' | 'post-upload' | null
  rejectOnUnknown: boolean
}

/**
 * Shape of FileScanResult as returned by the API. Mirrors the library interface
 * without importing server-only code.
 */
export interface FileScanResultShape {
  status: 'clean' | 'infected' | 'unknown'
  engine: string
  threat?: string
  details?: Record<string, unknown>
}

/**
 * API response shape for POST /scanner/upload. Contains the library result,
 * the raw object key, the scan verdict, and an optional warning.
 */
export interface ScannerUploadResult {
  key: string
  verdict: FileScanResultShape
  warning?: string
}

/** Body accepted by POST /scanner/upload. */
export interface ScannerUploadBody {
  /** Text content. An `X-DEMO-INFECTED` or `X-DEMO-UNKNOWN` marker drives the verdict. */
  content: string
  /** Optional deterministic key seed (alphanumeric, no spaces). */
  keySeed?: string
}

/** Query key for scanner configuration. */
export const SCANNER_CONFIG_KEY = ['scanner', 'config'] as const

/**
 * Fetches the active scanner configuration.
 *
 * @returns TanStack Query result with ScannerConfig.
 */
export function useScannerConfig() {
  return useQuery({
    queryKey: SCANNER_CONFIG_KEY,
    queryFn: () => apiGet<ScannerConfig>('/scanner/config'),
    staleTime: 30_000,
  })
}

/**
 * Mutation to upload text content through the scanner pipeline and get a verdict.
 * The POST /scanner/upload endpoint accepts a JSON body — not a file upload.
 *
 * @returns TanStack mutation that calls POST /scanner/upload with a JSON body.
 */
export function useScannerUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ScannerUploadBody) => apiPost<ScannerUploadResult>('/scanner/upload', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault'] }),
  })
}
