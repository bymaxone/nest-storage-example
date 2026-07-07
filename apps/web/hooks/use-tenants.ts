/**
 * @fileoverview TanStack Query hooks for tenant isolation: listing per-tenant
 * objects, uploading under a tenant prefix, and clearing a tenant's objects.
 * @layer hooks/use-tenants
 */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiDelete, apiPostForm } from '@/lib/api-client'
import type { ListedObject, UploadResult } from '@bymax-one/nest-storage/shared'

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
 * Mutation to upload a file under a tenant's prefix.
 *
 * @returns TanStack mutation that calls POST /tenants/:tenant/upload.
 */
export function useTenantUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tenant, file }: { tenant: string; file: File }) => {
      const form = new FormData()
      form.append('file', file)
      return apiPostForm<UploadResult>(`/tenants/${encodeURIComponent(tenant)}/upload`, form)
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
