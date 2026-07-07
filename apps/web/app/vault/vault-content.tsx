/**
 * @fileoverview Vault browser client content — folder breadcrumbs, object
 * table with cursor pagination, detail drawer, and lifecycle actions.
 *
 * @layer app/vault/vault-content
 */

'use client'

import { useState } from 'react'
import { useQueryState } from 'nuqs'
import { Trash2, Copy, RefreshCw, ChevronLeft, ChevronRight, Folder } from 'lucide-react'
import { toast } from 'sonner'
import { useVaultList, useDeleteObject, useBulkDelete, useCopyObject } from '@/hooks/use-vault'
import type { ListedObject } from '@bymax-one/nest-storage/shared'
import { FolderBreadcrumbs } from '@/components/vault/FolderBreadcrumbs'
import { KeyDetailDrawer } from '@/components/vault/KeyDetailDrawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { formatBytes } from '@/lib/format'

/** Vault browser body with folder nav, object table, drawer, and actions. */
export function VaultContent() {
  const [prefix, setPrefix] = useQueryState('prefix', { defaultValue: '' })
  const [cursor, setCursor] = useQueryState('cursor', { defaultValue: '' })
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const list = useVaultList({
    ...(prefix ? { prefix } : {}),
    delimiter: '/',
    ...(cursor ? { cursor } : {}),
    maxKeys: 50,
  })

  const deleteOne = useDeleteObject()
  const bulkDelete = useBulkDelete()
  const copy = useCopyObject()

  function toggleCheck(key: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleDelete(key: string) {
    try {
      const r = await deleteOne.mutateAsync(key)
      toast.success(r.warned ? `Deleted ${key} (already absent, idempotent)` : `Deleted ${key}`)
      setSelectedKey(null)
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`)
    }
  }

  async function handleBulkDelete() {
    const keys = [...checked]
    if (keys.length === 0) return
    try {
      const r = await bulkDelete.mutateAsync(keys)
      if (r.failed.length > 0) {
        toast.warning(`Bulk delete: ${r.deleted.length} deleted, ${r.failed.length} failed`)
      } else {
        toast.success(`Bulk deleted ${r.deleted.length} objects`)
      }
      setChecked(new Set())
    } catch (e) {
      toast.error(`Bulk delete failed: ${(e as Error).message}`)
    }
  }

  async function handleCopyToArchive(key: string) {
    try {
      await copy.mutateAsync({
        sourceKey: key,
        destinationKey: key,
        destination: 'archive',
      })
      toast.success(`Copied ${key} to archive bucket`)
    } catch (e) {
      toast.error(`Copy failed: ${(e as Error).message}`)
    }
  }

  const objects: ListedObject[] = list.data?.objects ?? []
  const prefixes: string[] = list.data?.commonPrefixes ?? []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold">Vault Browser</h1>
          <FolderBreadcrumbs
            prefix={prefix}
            onNavigate={(p) => {
              void setPrefix(p)
              void setCursor('')
              setChecked(new Set())
            }}
            className="mt-1"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            void list.refetch()
          }}
          aria-label="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Bulk action bar */}
      {checked.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-2">
          <span className="text-sm text-red-400">{checked.size} selected</span>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void handleBulkDelete()}
            disabled={bulkDelete.isPending}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Bulk Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Main table */}
      <Card>
        <CardContent className="p-0">
          {list.isLoading && (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {list.isError && (
            <p className="p-4 text-sm text-red-400">
              Failed to load vault objects. Is the API running?
            </p>
          )}

          {!list.isLoading && !list.isError && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-(--glass-border) text-xs text-white/40">
                  <th className="w-8 p-3" />
                  <th className="p-3 text-left font-normal">Key</th>
                  <th className="p-3 text-right font-normal">Size</th>
                  <th className="p-3 text-right font-normal">Modified</th>
                  <th className="w-16 p-3" />
                </tr>
              </thead>
              <tbody>
                {/* Folder entries */}
                {prefixes.map((p) => (
                  <tr
                    key={p}
                    className="border-b border-(--glass-border) last:border-0 hover:bg-white/3"
                  >
                    <td className="p-3" />
                    <td className="p-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-brand-400 hover:text-brand-300"
                        onClick={() => {
                          void setPrefix(p)
                          void setCursor('')
                        }}
                      >
                        <Folder className="h-3 w-3" aria-hidden="true" />
                        {p}
                      </button>
                    </td>
                    <td colSpan={3} />
                  </tr>
                ))}

                {/* Object entries */}
                {objects.map((obj) => (
                  <tr
                    key={obj.key}
                    className="border-b border-(--glass-border) last:border-0 hover:bg-white/3"
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={checked.has(obj.key)}
                        onChange={() => toggleCheck(obj.key)}
                        aria-label={`Select ${obj.key}`}
                        className="accent-brand-500"
                      />
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        className="max-w-xs truncate font-mono text-xs text-white/80 hover:text-brand-400"
                        onClick={() => setSelectedKey(obj.key)}
                      >
                        {obj.key}
                      </button>
                    </td>
                    <td className="p-3 text-right font-mono text-xs text-white/50">
                      {formatBytes(obj.size)}
                    </td>
                    <td className="p-3 text-right font-mono text-xs text-white/40">
                      {new Date(obj.lastModified).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Copy ${obj.key} to archive`}
                          onClick={() => void handleCopyToArchive(obj.key)}
                          className="rounded p-1 text-white/30 hover:text-brand-400"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${obj.key}`}
                          onClick={() => void handleDelete(obj.key)}
                          className="rounded p-1 text-white/30 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {prefixes.length === 0 && objects.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                      No objects in this path.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" disabled={!cursor} onClick={() => void setCursor('')}>
          <ChevronLeft className="mr-1 h-3.5 w-3.5" /> First page
        </Button>
        {list.data?.nextCursor && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              page {cursor ? 'N' : '1'}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void setCursor(list.data?.nextCursor ?? '')}
            >
              Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Detail drawer overlay */}
      {selectedKey && (
        <>
          <button
            type="button"
            aria-label="Close drawer"
            onClick={() => setSelectedKey(null)}
            className="fixed inset-0 z-200 bg-black/50 backdrop-blur-sm"
          />
          <KeyDetailDrawer objectKey={selectedKey} onClose={() => setSelectedKey(null)} />
        </>
      )}
    </div>
  )
}
