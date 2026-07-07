/**
 * @fileoverview TanStack Query hook for the storage health probe.
 * @layer hooks/use-health
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

/** Health report returned by GET /health. */
export interface HealthReport {
  status: 'up' | 'down'
  latencyMs: number
  bucket: string
}

/** Query key for the health endpoint. */
export const HEALTH_QUERY_KEY = ['health'] as const

/**
 * Polls the storage health endpoint and returns its result.
 *
 * @param refetchInterval - How often to re-poll in ms. Defaults to 10000.
 * @returns TanStack Query result with the HealthReport.
 */
export function useHealth(refetchInterval = 10_000) {
  return useQuery({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: () => apiGet<HealthReport>('/health'),
    refetchInterval,
  })
}
