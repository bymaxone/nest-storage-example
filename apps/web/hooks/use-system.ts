/**
 * @fileoverview TanStack Query hooks for the system page: resolved config
 * (credentials redacted), provider recipes, and bucket versioning status.
 * @layer hooks/use-system
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'

/**
 * Raw redacted configuration returned by GET /system/config. The API nests the
 * multipart and scanner options; the UI flattens the fields it renders into
 * {@link StorageConfig}.
 */
export interface SystemConfigResponse {
  endpoint: string
  region: string
  bucket: string
  keyPrefix?: string
  publicBaseUrl?: string
  signedUrls: {
    defaultGetTtlSeconds: number
    defaultPutTtlSeconds: number
    maxTtlSeconds: number
  }
  multipart: {
    thresholdBytes: number
    partSizeBytes: number
    queueSize: number
  }
  scanner: {
    impl: string
    mode: string
    rejectOnUnknown: boolean
  }
}

/** Flattened storage configuration shape rendered by the System config tab. */
export interface StorageConfig {
  endpoint: string
  region: string
  bucket: string
  keyPrefix?: string
  multipartThreshold: number
  scannerImpl: string
  scannerMode: string
  rejectOnUnknown: boolean
  maxTtlSeconds: number
}

/** One provider recipe entry. */
export interface RecipeView {
  provider: string
  options: Record<string, unknown>
  quirks: string[]
}

/** Versioning status for a single bucket. */
export interface BucketVersioning {
  bucket: string
  status: string
}

/** Bucket versioning status returned by GET /system/versioning. */
export interface VersioningStatus {
  buckets: BucketVersioning[]
  tradeOffNote: string
}

/**
 * Fetches the resolved (redacted) storage module configuration.
 *
 * @returns TanStack Query result with StorageConfig.
 */
export function useStorageConfig() {
  return useQuery({
    queryKey: ['system', 'config'],
    queryFn: () => apiGet<SystemConfigResponse>('/system/config'),
    staleTime: 60_000,
    // Flatten the nested API response into the shape the config tab renders.
    select: (raw): StorageConfig => ({
      endpoint: raw.endpoint,
      region: raw.region,
      bucket: raw.bucket,
      ...(raw.keyPrefix !== undefined ? { keyPrefix: raw.keyPrefix } : {}),
      multipartThreshold: raw.multipart.thresholdBytes,
      scannerImpl: raw.scanner.impl,
      scannerMode: raw.scanner.mode,
      rejectOnUnknown: raw.scanner.rejectOnUnknown,
      maxTtlSeconds: raw.signedUrls.maxTtlSeconds,
    }),
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
