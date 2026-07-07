/**
 * @fileoverview Error explorer — all STORAGE_ERROR_CODES with trigger buttons,
 * live response envelope panels, and HTTP status indicators.
 * @layer app/errors
 */

'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useErrorCatalogue, useTriggerError } from '@/hooks/use-errors'
import { httpStatusColor } from '@/lib/storage-status'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { TriggeredError } from '@/hooks/use-errors'
import { TriangleAlert, Zap } from 'lucide-react'

/** Renders the JSON error envelope from a triggered error. */
function EnvelopePanel({ error }: { error: TriggeredError }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={`font-mono text-[10px] border-white/15 ${httpStatusColor(error.status)}`}
        >
          HTTP {error.status}
        </Badge>
        <Badge variant="outline" className="font-mono text-[10px] border-white/15 text-brand-500">
          {error.code}
        </Badge>
      </div>
      <p className="text-xs text-white/65">{error.message}</p>
      {error.details && (
        <pre className="text-[10px] text-white/40 font-mono overflow-auto rounded bg-black/30 p-2 max-h-24">
          {JSON.stringify(error.details, null, 2)}
        </pre>
      )}
    </div>
  )
}

/**
 * Error explorer page — trigger each STORAGE_ERROR_CODE and inspect the typed
 * response envelope.
 *
 * @returns The error explorer page.
 */
export default function ErrorsPage() {
  const catalogue = useErrorCatalogue()
  const trigger = useTriggerError()
  const [results, setResults] = useState<Record<string, TriggeredError>>({})

  async function handleTrigger(code: string) {
    const result = await trigger.mutateAsync(code)
    setResults((prev) => ({ ...prev, [code]: result }))
  }

  return (
    <AppShell wide>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Error Explorer</h1>
          <p className="mt-1 text-sm text-white/55">
            Trigger each STORAGE_ERROR_CODE and inspect the typed response envelope
          </p>
        </div>

        {catalogue.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(catalogue.data ?? []).map((entry) => (
              <Card key={entry.code} className="border-white/8 bg-white/4">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-xs">
                    <TriangleAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <code className="font-mono text-amber-400 break-all">{entry.code}</code>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-white/50">{entry.description}</p>
                  <p className="text-[10px] text-white/35">Trigger: {entry.trigger}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-white/15 text-white/60"
                    onClick={() => {
                      void handleTrigger(entry.code)
                    }}
                    disabled={trigger.isPending}
                  >
                    <Zap className="mr-1.5 h-3 w-3" />
                    Trigger
                  </Button>
                  {results[entry.code] !== undefined && (
                    <EnvelopePanel error={results[entry.code]!} />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
