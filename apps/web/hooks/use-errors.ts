/**
 * @fileoverview TanStack Query hooks for the error explorer: fetching the
 * full error-code catalogue and triggering specific error codes.
 * @layer hooks/use-errors
 */
'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { apiGet, apiPost, StorageApiError } from '@/lib/api-client'
import type { StorageErrorCode } from '@bymax-one/nest-storage/shared'

/** One entry in the error catalogue. */
export interface ErrorEntry {
  code: string
  trigger: string
  description: string
}

/** Query key for the error catalogue. */
export const ERROR_CATALOGUE_KEY = ['errors', 'catalogue'] as const

/**
 * Fetches the full catalogue of triggerable storage error codes.
 *
 * @returns TanStack Query result with ErrorEntry[].
 */
export function useErrorCatalogue() {
  return useQuery({
    queryKey: ERROR_CATALOGUE_KEY,
    queryFn: () => apiGet<ErrorEntry[]>('/errors'),
    staleTime: Infinity,
  })
}

/** Snapshot of a triggered error response. */
export interface TriggeredError {
  code: StorageErrorCode | 'UNKNOWN'
  message: string
  status: number
  details: Record<string, unknown> | undefined
}

/**
 * Mutation to trigger a specific storage error code and capture the response.
 *
 * @returns TanStack mutation that calls POST /errors/:code.
 */
export function useTriggerError() {
  return useMutation({
    mutationFn: async (code: string): Promise<TriggeredError> => {
      try {
        await apiPost(`/errors/${code}`)
        return { code: 'UNKNOWN', message: 'No error thrown', status: 200, details: undefined }
      } catch (err) {
        // Typed API failures carry the code/status/details; anything else
        // (e.g. a network TypeError from fetch) maps to a safe UNKNOWN snapshot.
        if (err instanceof StorageApiError) {
          return { code: err.code, message: err.message, status: err.status, details: err.details }
        }
        const message = err instanceof Error ? err.message : 'Unknown error'
        return { code: 'UNKNOWN', message, status: 0, details: undefined }
      }
    },
  })
}
