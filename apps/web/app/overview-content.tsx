/**
 * @fileoverview Overview page client content — bucket stats, config summary,
 * quick action links, and recent uploads.
 *
 * @layer app/overview-content
 */

'use client'

import Link from 'next/link'
import { FolderOpen, Upload, Globe, Link as LinkIcon, Server } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { formatBytes } from '@/lib/format'
import { healthStatusDisplay } from '@/lib/storage-status'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { HealthReport } from '@/hooks/use-health'

interface SystemConfig {
  bucket?: string
  keyPrefix?: string
  endpoint?: string
  region?: string
  publicBaseUrl?: string
}

interface VaultPage {
  objects: Array<{ key: string; size: number; lastModified: string }>
  commonPrefixes: string[]
  nextCursor?: string
  truncated: boolean
}

/** Quick action item for the action grid. */
const QUICK_ACTIONS = [
  { label: 'Vault Browser', href: '/vault', icon: FolderOpen, desc: 'Browse and manage objects' },
  { label: 'Upload Lab', href: '/upload', icon: Upload, desc: 'Upload with strategies' },
  { label: 'Direct Upload', href: '/direct', icon: Globe, desc: 'Browser PUT via signed URL' },
  { label: 'Signed URLs', href: '/signed', icon: LinkIcon, desc: 'Issue expiring links' },
  { label: 'System', href: '/system', icon: Server, desc: 'Config and provider recipes' },
] as const

/**
 * Overview page body — polls health, shows config summary and recent objects.
 */
export function OverviewContent() {
  const health = useQuery<HealthReport>({
    queryKey: ['health'],
    queryFn: () => apiGet<HealthReport>('/health'),
    refetchInterval: 15_000,
    retry: 1,
  })

  const config = useQuery<SystemConfig>({
    queryKey: ['system', 'config'],
    queryFn: () => apiGet<SystemConfig>('/system/config'),
  })

  const recent = useQuery<VaultPage>({
    queryKey: ['vault', 'list', { maxKeys: 5 }],
    queryFn: () => apiGet<VaultPage>('/vault?maxKeys=5'),
  })

  const { label: healthLabel, color: healthColor } = healthStatusDisplay(
    health.data?.status ?? 'unknown',
  )

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="font-mono text-2xl font-bold text-foreground">Storage Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          @bymax-one/nest-storage reference dashboard — every library feature on one canvas.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Health"
          loading={health.isLoading}
          value={<span className={healthColor}>{health.isError ? 'Offline' : healthLabel}</span>}
        />
        <StatCard
          label="Latency"
          loading={health.isLoading}
          value={health.data ? `${String(health.data.latencyMs)} ms` : '—'}
        />
        <StatCard label="Bucket" loading={config.isLoading} value={config.data?.bucket ?? '—'} />
        <StatCard
          label="Key Prefix"
          loading={config.isLoading}
          value={config.data?.keyPrefix ?? '—'}
        />
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="mb-3 font-mono text-sm font-semibold uppercase tracking-wider text-white/40">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon
            return (
              <Link
                key={a.href}
                href={a.href}
                className="group flex flex-col gap-2 rounded-xl border border-(--glass-border) bg-(--glass-card-bg) p-4 transition-all hover:border-brand-500/30 hover:bg-brand-500/5"
              >
                <Icon className="h-5 w-5 text-brand-400 transition-colors group-hover:text-brand-300" />
                <span className="text-sm font-semibold text-foreground">{a.label}</span>
                <span className="text-xs text-muted-foreground">{a.desc}</span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Recent uploads */}
      <section>
        <h2 className="mb-3 font-mono text-sm font-semibold uppercase tracking-wider text-white/40">
          Recent Objects
        </h2>
        <Card>
          <CardContent className="pt-4">
            {recent.isLoading && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            )}
            {recent.isError && (
              <p className="text-sm text-red-400">
                Could not fetch objects — check that the API is running.
              </p>
            )}
            {recent.data?.objects.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No objects yet. Use the Upload Lab to add some.
              </p>
            )}
            {recent.data?.objects.map((obj) => (
              <div
                key={obj.key}
                className="flex items-center justify-between border-b border-(--glass-border) py-2 last:border-0"
              >
                <span className="max-w-[70%] truncate font-mono text-xs text-white/70">
                  {obj.key}
                </span>
                <Badge variant="outline" className="font-mono text-xs">
                  {formatBytes(obj.size)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Config summary */}
      <section>
        <h2 className="mb-3 font-mono text-sm font-semibold uppercase tracking-wider text-white/40">
          Config Summary
        </h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resolved Module Options</CardTitle>
          </CardHeader>
          <CardContent>
            {config.isLoading && <Skeleton className="h-20 w-full" />}
            {config.data && (
              <dl className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-3">
                {[
                  ['endpoint', config.data.endpoint],
                  ['region', config.data.region],
                  ['bucket', config.data.bucket],
                  ['keyPrefix', config.data.keyPrefix],
                  ['publicBaseUrl', config.data.publicBaseUrl],
                ]
                  .filter(([, v]) => Boolean(v))
                  .map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-white/30">{k}</dt>
                      <dd className="break-all text-white/70">{String(v)}</dd>
                    </div>
                  ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string
  value: React.ReactNode
  loading?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        {loading ? (
          <Skeleton className="h-5 w-24" />
        ) : (
          <span className="font-mono text-sm font-semibold text-foreground">{value}</span>
        )}
      </CardContent>
    </Card>
  )
}
