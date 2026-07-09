/**
 * @fileoverview TanStack Query hooks for tenant isolation: listing per-tenant
 * objects, uploading under a tenant prefix, and clearing a tenant's objects.
 * @layer hooks/use-tenants
 */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiDelete, apiPost } from '@/lib/api-client'
import { MAX_TEXT_UPLOAD_BYTES, truncateToByteLength } from '@/lib/text'
import type { ListedObject, UploadResult } from '@bymax-one/nest-storage/shared'

/** Response from POST /tenants/:tenant/upload. */
export interface TenantUploadResponse {
  tenant: string
  key: string
  fullKey: string
  result: UploadResult
}

/** Objects listed under a tenant prefix. */
export interface TenantObjects {
  objects: ListedObject[]
  prefix: string
}

/** Result of clearing all objects for a tenant. */
export interface TenantClearResult {
  deleted: number
  keys: string[]
}

/** List of known tenants. */
export interface TenantsListResult {
  tenants: string[]
}

/**
 * Fetches the list of available tenant identifiers.
 *
 * @returns TanStack Query result with TenantsListResult.
 */
export function useTenantsList() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: () => apiGet<TenantsListResult>('/tenants'),
    staleTime: 30_000,
  })
}

/**
 * Fetches all objects stored under a tenant's prefix.
 *
 * @param tenant - Tenant identifier.
 * @returns TanStack Query result with TenantObjects.
 */
export function useTenantObjects(tenant: string) {
  return useQuery({
    queryKey: ['tenants', tenant, 'objects'],
    queryFn: () => apiGet<TenantObjects>(`/tenants/${encodeURIComponent(tenant)}/objects`),
    enabled: tenant.length > 0,
  })
}

/**
 * Derives a storage-safe extension slug from a file name. Returns the lowercased
 * characters after the last dot when they form a 1-8 char alphanumeric slug;
 * otherwise falls back to `'txt'` (no dot, or a non-slug extension).
 *
 * @param fileName - The original file name.
 * @returns A 1-8 char lowercase alphanumeric extension, or `'txt'`.
 */
function deriveExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex === -1) return 'txt'
  const ext = fileName.slice(dotIndex + 1).toLowerCase()
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : 'txt'
}

/**
 * Mutation to upload a file under a tenant's prefix.
 *
 * @returns TanStack mutation that calls POST /tenants/:tenant/upload.
 */
export function useTenantUpload() {
  const qc = useQueryClient()
  return useMutation({
    // The tenant endpoint stores a text body under `{tenant}/{category}/{uuid}`.
    // Read the dropped file as text and derive a safe extension slug.
    mutationFn: async ({ tenant, file }: { tenant: string; file: File }) => {
      const text = truncateToByteLength(await file.text(), MAX_TEXT_UPLOAD_BYTES)
      return apiPost<TenantUploadResponse>(`/tenants/${encodeURIComponent(tenant)}/upload`, {
        category: 'files',
        content: text.length > 0 ? text : `demo upload ${file.name}`,
        extension: deriveExtension(file.name),
      })
    },
    onSuccess: (_data, { tenant }) => qc.invalidateQueries({ queryKey: ['tenants', tenant] }),
  })
}

/**
 * Mutation to delete all objects stored under a tenant's prefix.
 *
 * @returns TanStack mutation that calls DELETE /tenants/:tenant/objects.
 */
export function useTenantClear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tenant: string) =>
      apiDelete<TenantClearResult>(`/tenants/${encodeURIComponent(tenant)}/objects`),
    onSuccess: (_data, tenant) => qc.invalidateQueries({ queryKey: ['tenants', tenant] }),
  })
}
