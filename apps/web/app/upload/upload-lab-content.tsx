/**
 * @fileoverview Upload lab client content — single-shot upload with strategy
 * indicator, progress bar, idempotency card, and SSE selector.
 *
 * @layer app/upload/upload-lab-content
 */

'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { DEFAULT_MULTIPART_THRESHOLD_BYTES } from '@bymax-one/nest-storage/shared'
import { useSingleUpload, useIdempotentUpload, useSseOverrideUpload } from '@/hooks/use-uploads'
import {
  UploadDropzone,
  strategyFromMultipart,
  type UploadStrategy,
} from '@/components/transfer/UploadDropzone'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBytes } from '@/lib/format'
import type { UploadResult } from '@bymax-one/nest-storage/shared'

/** Upload lab body showing all server-side upload strategies. */
export function UploadLabContent() {
  const [lastResult, setLastResult] = useState<UploadResult | null>(null)
  const [strategy, setStrategy] = useState<UploadStrategy>('idle')
  const [idempotencyKey, setIdempotencyKey] = useState('demo-key-001')
  // Idempotency demo issues the SAME key twice, so results are not distinguishable
  // by their storage key; a monotonic call id gives each log row a stable identity.
  const [idempotencyResults, setIdempotencyResults] = useState<
    Array<{ callId: number; result: UploadResult }>
  >([])
  const [sseMode, setSseMode] = useState<'AES256' | 'NONE'>('NONE')
  const [sseResult, setSseResult] = useState<UploadResult | null>(null)

  const single = useSingleUpload()
  const idempotent = useIdempotentUpload()
  const sseOverride = useSseOverrideUpload()

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const result = await single.mutateAsync({ file })
        setLastResult(result)
        setStrategy(strategyFromMultipart(result.multipart))
        toast.success(`Uploaded: ${result.key}`)
      } catch (e) {
        toast.error(`Upload failed: ${(e as Error).message}`)
      }
    },
    [single],
  )

  const handleIdempotentUpload = useCallback(
    async (file: File) => {
      try {
        const result = await idempotent.mutateAsync({ file, idempotencyKey })
        setIdempotencyResults((prev) => [...prev, { callId: prev.length + 1, result }])
        toast.success(
          result.fromIdempotencyCache
            ? `Idempotency cache HIT — key: ${result.key}`
            : `Stored — key: ${result.key}`,
        )
      } catch (e) {
        toast.error(`Idempotent upload failed: ${(e as Error).message}`)
      }
    },
    [idempotent, idempotencyKey],
  )

  const handleSseUpload = useCallback(
    async (file: File) => {
      try {
        const result = await sseOverride.mutateAsync({ file, sse: sseMode })
        setSseResult(result)
        toast.success(`SSE ${sseMode} upload complete: ${result.key}`)
      } catch (e) {
        toast.error(`SSE upload failed: ${(e as Error).message}`)
      }
    },
    [sseOverride, sseMode],
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono text-2xl font-bold">Upload Lab</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Multipart threshold:{' '}
          <code className="font-mono text-brand-400">
            {formatBytes(DEFAULT_MULTIPART_THRESHOLD_BYTES)}
          </code>{' '}
          — files at or above this size use the multipart path.
        </p>
      </div>

      {/* Main upload dropzone */}
      <Card>
        <CardHeader accent>
          <CardTitle>Single / Multipart Upload</CardTitle>
          <CardDescription>Drop a file to see which strategy the library selects.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UploadDropzone onFile={handleFile} strategy={strategy} isPending={single.isPending} />
          {lastResult && (
            <div className="rounded-xl bg-(--glass-bg) p-4 font-mono text-xs">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white/40">Strategy:</span>
                <Badge variant={lastResult.multipart ? 'default' : 'outline'}>
                  {lastResult.multipart ? 'Multipart' : 'Single-shot'}
                </Badge>
              </div>
              <dl className="space-y-1">
                {[
                  ['key', lastResult.key],
                  ['bucket', lastResult.bucket],
                  ['size', lastResult.size !== undefined ? formatBytes(lastResult.size) : '—'],
                  ['etag', lastResult.etag],
                  ['contentType', lastResult.contentType],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-24 text-white/40">{k}</dt>
                    <dd className="text-white/80">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Idempotency demo */}
      <Card>
        <CardHeader accent>
          <CardTitle>Idempotent Upload</CardTitle>
          <CardDescription>
            Upload the same key twice — the second call returns instantly with{' '}
            <code className="font-mono text-brand-400">fromIdempotencyCache: true</code>. The cache
            is per-instance in-memory (LRU 1000 / 24 h TTL).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <label htmlFor="idempotency-key" className="sr-only">
              Idempotency key
            </label>
            <Input
              id="idempotency-key"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              placeholder="Idempotency key"
              className="max-w-xs"
            />
          </div>
          <UploadDropzone onFile={handleIdempotentUpload} isPending={idempotent.isPending} />
          {idempotencyResults.length > 0 && (
            <div className="space-y-2">
              {idempotencyResults.map(({ callId, result }) => (
                <div
                  key={callId}
                  className="flex items-center justify-between rounded-lg bg-(--glass-bg) px-3 py-2 font-mono text-xs"
                >
                  <span className="text-white/60">Call #{callId}</span>
                  <Badge variant={result.fromIdempotencyCache ? 'default' : 'outline'}>
                    {result.fromIdempotencyCache ? 'CACHE HIT' : 'Stored'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SSE override */}
      <Card>
        <CardHeader accent>
          <CardTitle>Server-Side Encryption Override</CardTitle>
          <CardDescription>
            Demonstrate per-call SSE with <code className="font-mono text-brand-400">AES256</code>{' '}
            or the <code className="font-mono text-brand-400">&apos;NONE&apos;</code> sentinel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            {(['AES256', 'NONE'] as const).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={sseMode === mode ? 'default' : 'outline'}
                onClick={() => setSseMode(mode)}
              >
                {mode}
              </Button>
            ))}
          </div>
          <UploadDropzone onFile={handleSseUpload} isPending={sseOverride.isPending} />
          {sseResult && (
            <p className="font-mono text-xs text-white/60">
              SSE:{' '}
              <span className="text-brand-400">
                {sseMode === 'NONE' ? 'NONE sentinel — encryption disabled' : sseMode}
              </span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
