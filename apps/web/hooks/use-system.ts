/**
 * @fileoverview TanStack Query hooks for the system page: resolved config
 * (credentials redacted), provider recipes, and bucket versioning status.
 * @layer hooks/use-system
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

/** Redacted storage configuration returned by GET /system/config. */
export interface StorageConfig {
  provider: string
  bucket: string
  keyPrefix?: string
  multipartThreshold: number
  scannerMode: string
  rejectOnUnknown: boolean
}

/** One provider recipe entry. */
export interface RecipeView {
  provider: string
  options: Record<string, unknown>
  quirks: string[]
}

/** Bucket versioning status. */
export interface VersioningStatus {
  versioned: boolean
  bucket: string
  status: string
}

/**
 * Fetches the resolved (redacted) storage module configuration.
 *
 * @returns TanStack Query result with StorageConfig.
 */
export function useStorageConfig() {
  return useQuery({
    queryKey: ['system', 'config'],
    queryFn: () => apiGet<StorageConfig>('/system/config'),
    staleTime: 60_000,
  })
}

/**
 * Fetches all provider recipe blueprints with their quirk notes.
 *
 * @returns TanStack Query result with RecipeView[].
 */
export function useProviderRecipes() {
  return useQuery({
    queryKey: ['system', 'recipes'],
    queryFn: () => apiGet<RecipeView[]>('/system/recipes'),
    staleTime: Infinity,
  })
}

/**
 * Fetches the bucket versioning status for the versioned bucket.
 *
 * @returns TanStack Query result with VersioningStatus.
 */
export function useVersioningStatus() {
  return useQuery({
    queryKey: ['system', 'versioning'],
    queryFn: () => apiGet<VersioningStatus>('/system/versioning'),
    staleTime: 60_000,
  })
}
