/**
 * @fileoverview TanStack Query hooks for vault object listing, metadata, and
 * mutations (delete, bulk-delete, copy). Signed URLs are never returned
 * from these hooks — see use-signed.ts.
 * @layer hooks/use-vault
 */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '@/lib/api-client'
import type { ListedObject, ObjectMetadata } from '@bymax-one/nest-storage/shared'

/** One page of vault objects. */
export interface VaultPage {
  objects: ListedObject[]
  commonPrefixes: string[]
  nextCursor?: string
  truncated: boolean
}

/** Parameters for the vault list query. */
export interface VaultListParams {
  prefix?: string
  maxKeys?: number
  cursor?: string
  delimiter?: string
}

/** Copy operation parameters. */
export interface CopyParams {
  sourceKey: string
  destinationKey: string
  destination?: string
  deleteSource?: boolean
}

/** Result of a server-side copy. */
export interface CopyResult {
  etag: string
  sourceKey: string
  destinationKey: string
  bucket: string
}

/** Result of a bulk delete operation. */
export interface BulkDeleteResult {
  deleted: string[]
  failed: Array<{ key: string; error: string }>
}

/** Public-URL response. */
export interface PublicUrlResult {
  publicUrl: string
  cdnUrl?: string
}

/** Builds the vault list query key from its params. */
export function vaultListKey(params: VaultListParams) {
  return ['vault', 'list', params] as const
}

/**
 * Fetches one page of vault objects with optional prefix and pagination.
 *
 * @param params - List query parameters.
 * @returns TanStack Query result with the vault page.
 */
export function useVaultList(params: VaultListParams) {
  const qs = new URLSearchParams()
  if (params.prefix) qs.set('prefix', params.prefix)
  if (params.maxKeys) qs.set('maxKeys', String(params.maxKeys))
  if (params.cursor) qs.set('cursor', params.cursor)
  if (params.delimiter) qs.set('delimiter', params.delimiter)
  const query = qs.toString()
  return useQuery({
    queryKey: vaultListKey(params),
    queryFn: () => apiGet<VaultPage>(`/vault${query ? `?${query}` : ''}`),
    staleTime: 5_000,
  })
}

/**
 * Fetches full ObjectMetadata for a single vault object.
 *
 * @param key - The object key to head.
 * @returns TanStack Query result with ObjectMetadata.
 */
export function useObjectMeta(key: string | null) {
  return useQuery({
    queryKey: ['vault', 'meta', key],
    queryFn: () => apiGet<ObjectMetadata>(`/vault/object?key=${encodeURIComponent(key!)}`),
    enabled: key !== null,
  })
}

/**
 * Mutation to delete a single vault object.
 *
 * @returns TanStack mutation that calls DELETE /vault/object?key=.
 */
export function useDeleteObject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (key: string) =>
      apiDelete<{ deleted: boolean }>(`/vault/object?key=${encodeURIComponent(key)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault'] }),
  })
}

/**
 * Mutation to bulk-delete vault objects.
 *
 * @returns TanStack mutation that calls POST /vault/bulk-delete.
 */
export function useBulkDelete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (keys: string[]) => apiPost<BulkDeleteResult>('/vault/bulk-delete', { keys }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault'] }),
  })
}

/**
 * Mutation to server-side copy a vault object.
 *
 * @returns TanStack mutation that calls POST /vault/copy.
 */
export function useCopyObject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: CopyParams) => apiPost<CopyResult>('/vault/copy', params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vault'] }),
  })
}

/**
 * Fetches public and CDN URLs for a vault object.
 *
 * @param key - The object key or null to skip.
 * @returns TanStack Query result with public URL data.
 */
export function usePublicUrl(key: string | null) {
  return useQuery({
    queryKey: ['vault', 'public-url', key],
    queryFn: () =>
      apiGet<PublicUrlResult>(`/vault/object/public-url?key=${encodeURIComponent(key!)}`),
    enabled: key !== null,
  })
}
