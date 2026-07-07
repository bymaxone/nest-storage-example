/**
 * @fileoverview Tenants page — multi-tenant key-prefix isolation demo showing
 * per-tenant object lists side by side to prove that objects from one tenant
 * do not appear in another's listing.
 * @layer app/tenants
 */

'use client'

import { useState, useRef } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useTenantObjects, useTenantUpload, useTenantClear } from '@/hooks/use-tenants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Users, Upload, Trash2, RefreshCw } from 'lucide-react'

/** Default tenants to demonstrate isolation. */
const DEFAULT_TENANTS = ['alpha', 'beta', 'gamma'] as const

/** Per-tenant panel showing its objects and upload/clear controls. */
function TenantPanel({ tenant }: { tenant: string }) {
  const { data, isLoading, refetch } = useTenantObjects(tenant)
  const upload = useTenantUpload()
  const clear = useTenantClear()
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    await upload.mutateAsync({ tenant, file })
    toast.success(`Uploaded to tenant: ${tenant}`)
    void refetch()
  }

  async function handleClear() {
    const res = await clear.mutateAsync(tenant)
    toast.success(`Cleared ${res.deleted} objects from ${tenant}`)
  }

  return (
    <Card className="border-white/8 bg-white/4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-500" />
            <code className="font-mono text-brand-500">{tenant}</code>
          </span>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-white/40 hover:text-white"
              onClick={() => {
                void refetch()
              }}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-white/40 hover:text-red-400"
              onClick={() => {
                void handleClear()
              }}
              disabled={clear.isPending || !data?.objects.length}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleUpload(f)
          }}
          aria-label={`Upload to tenant ${tenant}`}
        />
        <Button
          size="sm"
          variant="outline"
          className="w-full border-white/15 text-white/60"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Upload
        </Button>

        {isLoading ? (
          <div className="space-y-1.5">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : (
          <div className="min-h-[60px] space-y-1">
            {(data?.objects.length ?? 0) === 0 ? (
              <p className="py-3 text-center text-xs text-white/30">No objects</p>
            ) : (
              data?.objects.map((obj) => (
                <div
                  key={obj.key}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-white/3"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-white/65">
                    {obj.key.split('/').pop()}
                  </span>
                  <span className="shrink-0 text-white/35">{(obj.size / 1024).toFixed(1)} KB</span>
                </div>
              ))
            )}
          </div>
        )}
        {data?.prefix && (
          <p className="text-[10px] text-white/30 font-mono">prefix: {data.prefix}</p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Tenants page — multi-tenant key-prefix isolation demonstration.
 *
 * @returns The tenants page.
 */
export default function TenantsPage() {
  const [tenants, setTenants] = useState<string[]>([...DEFAULT_TENANTS])
  const [customTenant, setCustomTenant] = useState('')

  function addCustomTenant() {
    const t = customTenant.trim()
    if (!t || tenants.includes(t)) return
    setTenants((prev) => [...prev, t])
    setCustomTenant('')
    toast.info(`Added tenant: ${t}`)
  }

  return (
    <AppShell wide>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenant Isolation</h1>
          <p className="mt-1 text-sm text-white/55">
            Each tenant gets an isolated key-prefix scope — objects never bleed across tenants
          </p>
        </div>

        <Card className="border-white/8 bg-white/4">
          <CardContent className="p-4 text-sm text-white/55">
            <p>
              Key prefix isolation is enforced at the library level: the global{' '}
              <code className="font-mono text-white/70">keyPrefix</code> is prepended to every
              operation, and the tenant prefix is composed on top of it. The result is a
              hermetically sealed namespace per tenant —{' '}
              <code className="font-mono text-brand-500">list()</code> with the tenant prefix only
              ever returns that tenant's objects.
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Input
            placeholder="Add tenant identifier…"
            value={customTenant}
            onChange={(e) => setCustomTenant(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomTenant()}
            className="border-white/15 bg-white/4 text-white placeholder:text-white/30 font-mono text-sm"
          />
          <Button
            variant="outline"
            className="border-white/15 text-white/70 shrink-0"
            onClick={addCustomTenant}
          >
            Add Tenant
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {tenants.map((t) => (
            <TenantPanel key={t} tenant={t} />
          ))}
        </div>
      </div>
    </AppShell>
  )
}
