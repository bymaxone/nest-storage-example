/**
 * @fileoverview Signed URLs client content — GET link generator with TTL
 * clamp visualization and expiry countdown ring.
 *
 * @module app/signed/signed-content
 */

'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Copy } from 'lucide-react'
import { DEFAULT_SIGNED_URL_TTL_SECONDS } from '@bymax-one/nest-storage/shared'
import { useSignedDownloadUrl } from '@/hooks/use-signed'
import { TtlCountdown } from '@/components/transfer/TtlCountdown'
import { EnvelopePanel, type EnvelopePanelData } from '@/components/labs/EnvelopePanel'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StorageApiError } from '@/lib/api-client'

interface DownloadUrlResponse {
  url: string
  expiresAt: string
  requestedTtl: number
  effectiveTtl: number
}

/** Masks the query string of a URL for safe display. */
function maskUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}?[signed-params-hidden]`
  } catch {
    return '[url-hidden]'
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  } catch {
    toast.error('Clipboard write failed')
  }
}

/** Signed URLs body showing the TTL clamp demo and countdown. */
export function SignedContent() {
  const [objectKey, setObjectKey] = useState('storage-example/demo.txt')
  const [requestedTtl, setRequestedTtl] = useState(7200) // 2 hours — above the 1-hour cap
  const [signedResult, setSignedResult] = useState<DownloadUrlResponse | null>(null)
  const [error, setError] = useState<EnvelopePanelData | null>(null)

  const issue = useSignedDownloadUrl()

  async function handleIssue() {
    setError(null)
    setSignedResult(null)
    try {
      const r = await issue.mutateAsync({
        key: objectKey,
        ttlSeconds: requestedTtl,
      })
      setSignedResult(r)
      toast.success('Signed URL issued')
    } catch (e) {
      if (e instanceof StorageApiError) {
        setError({
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

  const wasClamped = signedResult !== null && signedResult.effectiveTtl < signedResult.requestedTtl

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono text-2xl font-bold">Signed URLs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Presigned GET link generator with TTL clamp visualization. Request a TTL above the
          server's <code className="font-mono text-brand-400">maxTtlSeconds</code> cap to see the
          silent clamp in action.
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader accent>
          <CardTitle>Issue Presigned GET URL</CardTitle>
          <CardDescription>
            Default TTL:{' '}
            <code className="font-mono text-brand-400">{DEFAULT_SIGNED_URL_TTL_SECONDS} s</code>.
            The server cap is configured to <code className="font-mono text-brand-400">3600 s</code>{' '}
            — try requesting 7200 s to trigger the silent clamp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-white/40">Object Key</label>
              <Input
                value={objectKey}
                onChange={(e) => setObjectKey(e.target.value)}
                placeholder="key to sign"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/40">Requested TTL (seconds)</label>
              <Input
                type="number"
                value={requestedTtl}
                onChange={(e) => setRequestedTtl(Number(e.target.value))}
                min={1}
                placeholder="TTL in seconds"
              />
            </div>
          </div>
          <Button onClick={() => void handleIssue()} disabled={issue.isPending}>
            Issue Signed URL
          </Button>
        </CardContent>
      </Card>

      {/* Error panel */}
      {error && <EnvelopePanel envelope={error} />}

      {/* Signed URL result */}
      {signedResult && (
        <Card>
          <CardHeader accent>
            <CardTitle className="flex items-center gap-2">
              Signed URL Issued
              {wasClamped && (
                <Badge variant="destructive" className="text-xs">
                  TTL Clamped
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* TTL comparison */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-(--glass-border) bg-(--glass-bg) p-3">
                <p className="mb-1 text-xs text-white/40">Requested TTL</p>
                <p className="font-mono text-lg font-bold text-white/80">
                  {signedResult.requestedTtl} s
                </p>
              </div>
              <div
                className={`rounded-xl border p-3 ${wasClamped ? 'border-yellow-400/30 bg-yellow-400/5' : 'border-(--glass-border) bg-(--glass-bg)'}`}
              >
                <p className="mb-1 text-xs text-white/40">Effective TTL</p>
                <p
                  className={`font-mono text-lg font-bold ${wasClamped ? 'text-yellow-400' : 'text-brand-400'}`}
                >
                  {signedResult.effectiveTtl} s
                  {wasClamped && (
                    <span className="ml-2 text-xs font-normal text-yellow-300">
                      (silently clamped)
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Countdown ring */}
            <div className="flex flex-col items-center gap-2">
              <TtlCountdown
                expiresAt={signedResult.expiresAt}
                ttlSeconds={signedResult.effectiveTtl}
              />
              <p className="text-xs text-muted-foreground">
                Expires: {new Date(signedResult.expiresAt).toLocaleString()}
              </p>
            </div>

            {/* Masked URL + copy button */}
            <div className="flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 font-mono text-xs">
              <code className="flex-1 truncate text-white/40">{maskUrl(signedResult.url)}</code>
              <button
                type="button"
                aria-label="Copy signed URL"
                onClick={() => void copyToClipboard(signedResult.url)}
                className="shrink-0 rounded p-1 text-brand-400 hover:text-brand-300"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-white/30">
              URL rendered masked — use the copy button to get the full value. Never log signed
              URLs.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ttl=0 demo */}
      <Card>
        <CardHeader accent>
          <CardTitle>TTL = 0 Error Demo</CardTitle>
          <CardDescription>
            A zero TTL is invalid — triggers{' '}
            <code className="font-mono text-brand-400">STORAGE_SIGNED_URL_TTL_INVALID</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TtlZeroDemo objectKey={objectKey} />
        </CardContent>
      </Card>
    </div>
  )
}

/** Demonstrates the TTL=0 → STORAGE_SIGNED_URL_TTL_INVALID path. */
function TtlZeroDemo({ objectKey }: { objectKey: string }) {
  const [error, setError] = useState<EnvelopePanelData | null>(null)
  const issue = useSignedDownloadUrl()

  async function trigger() {
    setError(null)
    try {
      await issue.mutateAsync({ key: objectKey, ttlSeconds: 0 })
    } catch (e) {
      if (e instanceof StorageApiError) {
        setError({
          httpStatus: e.status,
          code: e.code,
          message: e.message,
          ...(e.details !== undefined ? { details: e.details } : {}),
        })
      }
    }
  }

  return (
    <div className="space-y-3">
      <Button size="sm" variant="outline" onClick={() => void trigger()}>
        Trigger ttl=0 error
      </Button>
      {error && <EnvelopePanel envelope={error} />}
    </div>
  )
}
