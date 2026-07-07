/**
 * @fileoverview Detail drawer for a vault object. Shows four tabs:
 * Metadata, Preview (image), Range hex, and URLs (public + signed GET).
 * The signed URL is masked in the UI — a copy button copies the full value.
 *
 * @layer components/vault/KeyDetailDrawer
 */

'use client'

import { useState } from 'react'
import { Copy, X, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiGet, apiPost, type StorageApiError } from '@/lib/api-client'
import type { ObjectMetadata } from '@bymax-one/nest-storage/shared'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBytes, formatDate } from '@/lib/format'
import { HexPreview } from './HexPreview'
import { TtlCountdown } from '@/components/transfer/TtlCountdown'

interface BufferedResult {
  base64: string
  metadata: ObjectMetadata
}

interface SignedUrlResult {
  url: string
  expiresAt: string
  requestedTtl: number
  effectiveTtl: number
}

interface PublicUrlResult {
  publicUrl: string
  cdnUrl?: string
}

interface KeyDetailDrawerProps {
  /** The object key to inspect. */
  objectKey: string
  /** Called when the drawer should close. */
  onClose: () => void
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

/** Copies text to clipboard and shows a toast. */
async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  } catch {
    toast.error('Clipboard write failed')
  }
}

/**
 * Slide-in detail drawer for a vault object showing metadata, preview,
 * hex range, and URL tabs.
 */
export function KeyDetailDrawer({ objectKey, onClose }: KeyDetailDrawerProps) {
  const [signedUrl, setSignedUrl] = useState<SignedUrlResult | null>(null)

  const meta = useQuery<ObjectMetadata>({
    queryKey: ['vault', 'meta', objectKey],
    queryFn: () => apiGet<ObjectMetadata>(`/vault/object?key=${encodeURIComponent(objectKey)}`),
  })

  // Validated image content type — non-null only for image objects. The
  // preview query is enabled solely for these, so the `<img>` below always
  // has a concrete content type without needing a runtime fallback.
  const imageContentType =
    meta.data && meta.data.contentType.startsWith('image/') ? meta.data.contentType : null
  const isImage = imageContentType !== null

  const preview = useQuery<BufferedResult>({
    queryKey: ['vault', 'preview', objectKey],
    queryFn: () =>
      apiGet<BufferedResult>(`/vault/object/preview?key=${encodeURIComponent(objectKey)}`),
    enabled: isImage,
  })

  const range = useQuery<BufferedResult>({
    queryKey: ['vault', 'range', objectKey],
    queryFn: () =>
      apiGet<BufferedResult>(
        `/vault/object/range?key=${encodeURIComponent(objectKey)}&start=0&end=1023`,
      ),
  })

  const publicUrl = useQuery<PublicUrlResult>({
    queryKey: ['vault', 'public-url', objectKey],
    queryFn: () =>
      apiGet<PublicUrlResult>(`/vault/object/public-url?key=${encodeURIComponent(objectKey)}`),
  })

  const issueSignedUrl = useMutation({
    mutationFn: () =>
      apiPost<SignedUrlResult>('/signed/download-url', { key: objectKey, ttlSeconds: 300 }),
    onSuccess: (data) => setSignedUrl(data),
    onError: (e: StorageApiError) => toast.error(`Signed URL: ${e.message}`),
  })

  return (
    <div
      className="fixed inset-y-0 right-0 z-300 flex w-full max-w-xl flex-col border-l border-(--glass-border) bg-(--color-bg-primary) shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Object details"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-(--glass-border) px-4 py-3">
        <p className="max-w-[80%] truncate font-mono text-sm text-brand-400">{objectKey}</p>
        <button
          type="button"
          aria-label="Close drawer"
          onClick={onClose}
          className="rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <Tabs defaultValue="meta">
          <TabsList className="mb-4">
            <TabsTrigger value="meta">Metadata</TabsTrigger>
            <TabsTrigger value="preview" disabled={!isImage}>
              Preview
            </TabsTrigger>
            <TabsTrigger value="hex">Hex Range</TabsTrigger>
            <TabsTrigger value="urls">URLs</TabsTrigger>
          </TabsList>

          {/* ── Metadata ── */}
          <TabsContent value="meta">
            {meta.isLoading && <MetaSkeleton />}
            {meta.data && (
              <dl className="space-y-2 font-mono text-xs">
                {[
                  ['Key', meta.data.key],
                  ['Bucket', meta.data.bucket],
                  ['Size', formatBytes(meta.data.size)],
                  ['Content-Type', meta.data.contentType],
                  ['ETag', meta.data.etag],
                  ['Last Modified', formatDate(meta.data.lastModified)],
                  ...(meta.data.cacheControl
                    ? [['Cache-Control', meta.data.cacheControl] as const]
                    : []),
                  ...(meta.data.contentDisposition
                    ? [['Content-Disposition', meta.data.contentDisposition] as const]
                    : []),
                  ...(meta.data.storageClass
                    ? [['Storage Class', meta.data.storageClass] as const]
                    : []),
                  ...(meta.data.versionId ? [['Version ID', meta.data.versionId] as const] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-36 shrink-0 text-white/40">{k}</dt>
                    <dd className="flex-1 break-all text-white/80">{String(v)}</dd>
                  </div>
                ))}
                {Object.keys(meta.data.metadata).length > 0 && (
                  <>
                    <dt className="mt-3 text-white/40">Custom Metadata</dt>
                    {Object.entries(meta.data.metadata).map(([k, v]) => (
                      <div key={k} className="flex gap-2 pl-2">
                        <dt className="w-32 shrink-0 text-white/30">{k}</dt>
                        <dd className="flex-1 break-all text-white/70">{v}</dd>
                      </div>
                    ))}
                  </>
                )}
              </dl>
            )}
          </TabsContent>

          {/* ── Preview ── */}
          <TabsContent value="preview">
            {preview.isLoading && <Skeleton className="h-48 w-full rounded-xl" />}
            {preview.data && (
              <img
                src={`data:${imageContentType};base64,${preview.data.base64}`}
                alt={`Preview of ${objectKey}`}
                className="max-h-80 w-full rounded-xl object-contain"
              />
            )}
            {!isImage && (
              <p className="text-sm text-muted-foreground">
                Preview is only available for image objects.
              </p>
            )}
          </TabsContent>

          {/* ── Hex Range ── */}
          <TabsContent value="hex">
            {range.isLoading && <Skeleton className="h-32 w-full rounded-xl" />}
            {range.data && <HexPreview base64={range.data.base64} maxBytes={256} />}
            <p className="mt-2 text-xs text-white/40">Showing first 1 KiB (bytes 0–1023).</p>
          </TabsContent>

          {/* ── URLs ── */}
          <TabsContent value="urls">
            <div className="space-y-4">
              {/* Public URL */}
              {publicUrl.data && (
                <div className="rounded-xl border border-(--glass-border) bg-(--glass-bg) p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/60">Public URL</span>
                    <Badge variant="outline" className="text-xs">
                      unsigned
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate font-mono text-xs text-white/70">
                      {publicUrl.data.publicUrl}
                    </code>
                    <button
                      type="button"
                      aria-label="Copy public URL"
                      onClick={() => void copyToClipboard(publicUrl.data.publicUrl, 'Public URL')}
                      className="rounded p-1 text-white/40 hover:text-white/80"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={publicUrl.data.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open public URL in new tab"
                      className="rounded p-1 text-white/40 hover:text-white/80"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* Signed URL */}
              <div className="rounded-xl border border-(--glass-border) bg-(--glass-bg) p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/60">Signed GET URL</span>
                  <Badge variant="outline" className="text-xs">
                    TTL 300 s
                  </Badge>
                </div>
                {signedUrl ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate font-mono text-xs text-white/40">
                        {maskUrl(signedUrl.url)}
                      </code>
                      <button
                        type="button"
                        aria-label="Copy signed URL"
                        onClick={() => void copyToClipboard(signedUrl.url, 'Signed URL')}
                        className="rounded p-1 text-brand-400 hover:text-brand-300"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <TtlCountdown
                      expiresAt={signedUrl.expiresAt}
                      ttlSeconds={signedUrl.effectiveTtl}
                      className="self-start"
                    />
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => issueSignedUrl.mutate()}
                    disabled={issueSignedUrl.isPending}
                  >
                    Issue Signed URL
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function MetaSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  )
}
