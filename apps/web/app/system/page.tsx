/**
 * @fileoverview System page — resolved storage config (credentials redacted),
 * provider recipes with quirk notes, and bucket versioning status.
 * @layer app/system
 */

'use client'

import { AppShell } from '@/components/layout/AppShell'
import { useStorageConfig, useProviderRecipes, useVersioningStatus } from '@/hooks/use-system'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Layers, GitBranch, TriangleAlert } from 'lucide-react'

/** Renders one config label/value row. */
function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm border-b border-white/6 last:border-0">
      <span className="text-white/50 shrink-0">{label}</span>
      <code className="font-mono text-white/80 text-right break-all">{value}</code>
    </div>
  )
}

/**
 * System page — config, provider recipes, and versioning.
 *
 * @returns The system page.
 */
export default function SystemPage() {
  const config = useStorageConfig()
  const recipes = useProviderRecipes()
  const versioning = useVersioningStatus()

  return (
    <AppShell wide>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">System</h1>
          <p className="mt-1 text-sm text-white/55">
            Resolved configuration, provider recipes, and bucket versioning
          </p>
        </div>

        <Tabs defaultValue="config">
          <TabsList className="border border-white/10 bg-white/4">
            <TabsTrigger
              value="config"
              className="data-[state=active]:bg-brand-500/15 data-[state=active]:text-brand-500"
            >
              <Settings className="mr-2 h-3.5 w-3.5" />
              Config
            </TabsTrigger>
            <TabsTrigger
              value="recipes"
              className="data-[state=active]:bg-brand-500/15 data-[state=active]:text-brand-500"
            >
              <Layers className="mr-2 h-3.5 w-3.5" />
              Recipes
            </TabsTrigger>
            <TabsTrigger
              value="versioning"
              className="data-[state=active]:bg-brand-500/15 data-[state=active]:text-brand-500"
            >
              <GitBranch className="mr-2 h-3.5 w-3.5" />
              Versioning
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="mt-4">
            <Card className="border-white/8 bg-white/4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-white/70">
                  Resolved Module Options (credentials redacted)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {config.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : config.data ? (
                  <div>
                    <ConfigRow label="endpoint" value={config.data.endpoint} />
                    <ConfigRow label="region" value={config.data.region} />
                    <ConfigRow label="bucket" value={config.data.bucket} />
                    {config.data.keyPrefix !== undefined && (
                      <ConfigRow label="keyPrefix" value={config.data.keyPrefix} />
                    )}
                    <ConfigRow
                      label="multipartThreshold"
                      value={`${config.data.multipartThreshold.toLocaleString()} bytes`}
                    />
                    <ConfigRow label="scanner" value={config.data.scannerImpl} />
                    <ConfigRow label="scannerMode" value={config.data.scannerMode} />
                    <ConfigRow
                      label="rejectOnUnknown"
                      value={String(config.data.rejectOnUnknown)}
                    />
                    <ConfigRow
                      label="maxTtlSeconds"
                      value={`${config.data.maxTtlSeconds.toLocaleString()} s`}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-white/40">Failed to load config</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recipes" className="mt-4">
            {recipes.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(recipes.data ?? []).map((recipe) => (
                  <Card key={recipe.provider} className="border-white/8 bg-white/4">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Layers className="h-4 w-4 text-brand-500" />
                        <code className="font-mono text-brand-500">{recipe.provider}</code>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <pre className="overflow-auto rounded bg-black/30 p-3 text-[11px] text-white/65 font-mono max-h-32">
                        {JSON.stringify(recipe.options, null, 2)}
                      </pre>
                      {recipe.quirks.length > 0 && (
                        <div className="space-y-1">
                          {recipe.quirks.map((q) => (
                            <div key={q} className="flex items-start gap-2 text-xs text-white/45">
                              <TriangleAlert
                                className="h-3 w-3 shrink-0 text-amber-400/60"
                                aria-hidden="true"
                              />
                              <span>{q}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="versioning" className="mt-4">
            <Card className="border-white/8 bg-white/4">
              <CardContent className="space-y-3 p-5">
                {versioning.isLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : versioning.data ? (
                  <>
                    {versioning.data.buckets.map(({ bucket, status }) => {
                      const enabled = status === 'Enabled'
                      return (
                        <div key={bucket} className="flex items-center gap-3">
                          <GitBranch
                            className={`h-5 w-5 shrink-0 ${enabled ? 'text-brand-500' : 'text-white/30'}`}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">
                              <code className="font-mono">{bucket}</code>
                            </p>
                            <p className="mt-0.5 text-xs text-white/45">
                              {enabled ? 'Versioning enabled' : 'Versioning disabled'}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`ml-auto shrink-0 border-white/15 ${enabled ? 'text-green-400' : 'text-white/50'}`}
                          >
                            {status}
                          </Badge>
                        </div>
                      )
                    })}
                    {versioning.data.tradeOffNote && (
                      <p className="border-t border-white/6 pt-3 text-xs text-white/40">
                        {versioning.data.tradeOffNote}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-white/40">Failed to load versioning status</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
