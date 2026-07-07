/**
 * @fileoverview Scanner lab client content — verdict cards for clean/infected/unknown
 * content markers, config view, and post-upload removal proof.
 *
 * @module app/scanner/scanner-content
 */

'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiGet, apiPost, StorageApiError } from '@/lib/api-client'
import { VerdictCard } from '@/components/labs/VerdictCard'
import { EnvelopePanel, type EnvelopePanelData } from '@/components/labs/EnvelopePanel'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ScannerConfig {
  enabled: boolean
  mode: 'pre-upload' | 'post-upload' | null
  rejectOnUnknown: boolean
}

/**
 * Shape of FileScanResult as returned by the API. Mirrors the library interface
 * without importing server-only code.
 */
interface FileScanResultShape {
  status: 'clean' | 'infected' | 'unknown'
  engine: string
  threat?: string
  details?: Record<string, unknown>
}

/** API response for POST /scanner/upload (only reached for accepted verdicts). */
interface ScannerUploadResult {
  key: string
  verdict: FileScanResultShape
  warning?: string
}

interface ScannerExistsResult {
  key: string
  exists: boolean
}

/** Scanner lab body. */
export function ScannerContent() {
  const [lastResult, setLastResult] = useState<ScannerUploadResult | null>(null)
  const [envelope, setEnvelope] = useState<EnvelopePanelData | null>(null)

  const config = useQuery<ScannerConfig>({
    queryKey: ['scanner', 'config'],
    queryFn: () => apiGet<ScannerConfig>('/scanner/config'),
  })

  async function triggerScan(marker: 'clean' | 'infected' | 'unknown') {
    setEnvelope(null)
    setLastResult(null)

    const contentMap: Record<string, string> = {
      clean: 'This is clean content without any markers.',
      infected: 'X-DEMO-INFECTED This content has the infected marker.',
      unknown: 'X-DEMO-UNKNOWN This content has the unknown marker.',
    }

    try {
      const result = await apiPost<ScannerUploadResult>('/scanner/upload', {
        content: contentMap[marker],
        keySeed: `demo-${marker}`,
      })
      setLastResult(result)
      if (result.warning) toast.warning(result.warning)
      else toast.success(`Scan complete: ${result.verdict.status}`)
    } catch (e) {
      if (e instanceof StorageApiError) {
        setEnvelope({
          httpStatus: e.status,
          code: e.code,
          message: e.message,
          ...(e.details !== undefined ? { details: e.details } : {}),
        })
      } else {
        toast.error((e as Error).message)
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono text-2xl font-bold">Scanner Lab</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The stub scanner uses content markers:{' '}
          <code className="font-mono text-brand-400">X-DEMO-INFECTED</code> → infected,{' '}
          <code className="font-mono text-brand-400">X-DEMO-UNKNOWN</code> → unknown, anything else
          → clean. Inert demo content — no real malware.
        </p>
      </div>

      {/* Config */}
      {config.data && (
        <Card>
          <CardHeader accent>
            <CardTitle>Active Scanner Config</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <div className="rounded-xl border border-(--glass-border) bg-(--glass-bg) px-4 py-3">
              <p className="text-xs text-white/40">Mode</p>
              <p className="font-mono text-sm font-bold text-brand-400">{config.data.mode}</p>
            </div>
            <div className="rounded-xl border border-(--glass-border) bg-(--glass-bg) px-4 py-3">
              <p className="text-xs text-white/40">rejectOnUnknown</p>
              <Badge variant={config.data.rejectOnUnknown ? 'default' : 'outline'}>
                {String(config.data.rejectOnUnknown)}
              </Badge>
            </div>
            <div className="rounded-xl border border-(--glass-border) bg-(--glass-bg) px-4 py-3">
              <p className="text-xs text-white/40">Enabled</p>
              <Badge variant={config.data.enabled ? 'default' : 'secondary'}>
                {String(config.data.enabled)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verdict triggers */}
      <Card>
        <CardHeader accent>
          <CardTitle>Trigger Scan Verdicts</CardTitle>
          <CardDescription>
            Send content with different markers to drive the three scanner verdicts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {(['clean', 'infected', 'unknown'] as const).map((v) => (
              <Button key={v} size="sm" variant="outline" onClick={() => void triggerScan(v)}>
                Send {v} content
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Envelope for rejected scans */}
      {envelope && <EnvelopePanel envelope={envelope} />}

      {/* Verdict card */}
      {lastResult && !envelope && (
        <div className="space-y-4">
          <VerdictCard
            verdict={lastResult.verdict.status}
            {...(lastResult.verdict.threat !== undefined
              ? { threat: lastResult.verdict.threat }
              : {})}
            description={`Engine: ${lastResult.verdict.engine}${lastResult.warning ? ` — ${lastResult.warning}` : ''}`}
          />

          {/* Existence probe: shows whether the object survived post-upload scanning */}
          <ExistsProof objectKey={lastResult.key} />
        </div>
      )}
    </div>
  )
}

/** Inline existence probe — shows whether the object survived post-upload scanning. */
function ExistsProof({ objectKey }: { objectKey: string }) {
  const probe = useQuery<ScannerExistsResult>({
    queryKey: ['scanner', 'exists', objectKey],
    queryFn: () =>
      apiGet<ScannerExistsResult>(`/scanner/exists?key=${encodeURIComponent(objectKey)}`),
  })

  if (probe.isLoading || !probe.data) return null

  return (
    <div className="flex items-center gap-2 rounded-xl border border-(--glass-border) bg-(--glass-bg) px-4 py-3 text-sm">
      <span className="text-white/50">Object present after scan:</span>
      <Badge variant={probe.data.exists ? 'outline' : 'destructive'}>
        {String(probe.data.exists)}
      </Badge>
      {!probe.data.exists && (
        <span className="text-xs text-red-300">(removed by post-upload scanner)</span>
      )}
    </div>
  )
}
