/**
 * @fileoverview Validation lab client content — active rules matrix, size limit,
 * and magic-byte forgery demo that drives the three failure paths.
 *
 * @layer app/validation/validation-content
 */

'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  DEFAULT_IMAGE_MIME_WHITELIST,
  DEFAULT_DOC_MIME_WHITELIST,
} from '@bymax-one/nest-storage/shared'
import { apiGet, apiPostForm, StorageApiError } from '@/lib/api-client'
import { EnvelopePanel, type EnvelopePanelData } from '@/components/labs/EnvelopePanel'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ValidationRulesView {
  mimeWhitelist: string[]
  maxSizeBytes: number
  customValidators: string[]
}

interface ValidationUploadResult {
  key: string
  size: number
  contentType: string
}

/** Envelope returned by POST /validation/upload: the upload result plus the
 * active rules that accepted it. */
interface ValidationUploadEnvelope {
  result: ValidationUploadResult
  rules: ValidationRulesView
}

/** Validation lab body with live rules and demo triggers. */
export function ValidationContent() {
  const [envelope, setEnvelope] = useState<EnvelopePanelData | null>(null)
  const [lastResult, setLastResult] = useState<ValidationUploadResult | null>(null)

  const rules = useQuery<ValidationRulesView>({
    queryKey: ['validation', 'rules'],
    queryFn: () => apiGet<ValidationRulesView>('/validation/rules'),
  })

  async function triggerMimeRejection() {
    setEnvelope(null)
    setLastResult(null)
    const form = new FormData()
    const blob = new Blob(['test content'], { type: 'application/zip' })
    form.append('file', new File([blob], 'archive.zip', { type: 'application/zip' }))
    try {
      const { result } = await apiPostForm<ValidationUploadEnvelope>('/validation/upload', form)
      setLastResult(result)
      toast.success('Uploaded (unexpected — check whitelist)')
    } catch (e) {
      if (e instanceof StorageApiError) {
        setEnvelope({
          httpStatus: e.status,
          code: e.code,
          message: e.message,
          ...(e.details !== undefined ? { details: e.details } : {}),
        })
      }
    }
  }

  async function triggerSizeRejection() {
    setEnvelope(null)
    setLastResult(null)
    // 30 MiB > the 25 MiB cap
    const bigBuffer = new Uint8Array(30 * 1024 * 1024)
    const form = new FormData()
    form.append('file', new File([bigBuffer], 'huge.bin', { type: 'image/png' }))
    try {
      const { result } = await apiPostForm<ValidationUploadEnvelope>('/validation/upload', form)
      setLastResult(result)
    } catch (e) {
      if (e instanceof StorageApiError) {
        setEnvelope({
          httpStatus: e.status,
          code: e.code,
          message: e.message,
          ...(e.details !== undefined ? { details: e.details } : {}),
        })
      }
    }
  }

  async function triggerMagicByteRejection() {
    setEnvelope(null)
    setLastResult(null)
    // A text file named .pdf — fails the PDF magic-byte validator
    const form = new FormData()
    const blob = new Blob(['NOT A PDF — plain text'], { type: 'application/pdf' })
    form.append('file', new File([blob], 'fake.pdf', { type: 'application/pdf' }))
    try {
      const { result } = await apiPostForm<ValidationUploadEnvelope>('/validation/upload', form)
      setLastResult(result)
    } catch (e) {
      if (e instanceof StorageApiError) {
        setEnvelope({
          httpStatus: e.status,
          code: e.code,
          message: e.message,
          ...(e.details !== undefined ? { details: e.details } : {}),
        })
      }
    }
  }

  async function triggerCleanUpload() {
    setEnvelope(null)
    setLastResult(null)
    const form = new FormData()
    // Minimal 1-pixel PNG (valid magic bytes)
    const PNG_1PX =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    const binaryStr = atob(PNG_1PX)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'image/png' })
    form.append('file', new File([blob], 'valid.png', { type: 'image/png' }))
    try {
      const { result } = await apiPostForm<ValidationUploadEnvelope>('/validation/upload', form)
      setLastResult(result)
      toast.success(`Uploaded: ${result.key}`)
    } catch (e) {
      if (e instanceof StorageApiError) {
        setEnvelope({
          httpStatus: e.status,
          code: e.code,
          message: e.message,
          ...(e.details !== undefined ? { details: e.details } : {}),
        })
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono text-2xl font-bold">Validation Lab</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every upload runs through the library validation pipeline: MIME whitelist → size cap →
          custom validators. Trigger each failure path below.
        </p>
      </div>

      {/* Active rules */}
      <Card>
        <CardHeader accent>
          <CardTitle>Active Validation Rules</CardTitle>
          <CardDescription>
            Sourced from the resolved module options — same values the pipeline enforces.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.data && (
            <>
              <div>
                <p className="mb-2 text-xs text-white/40">
                  MIME Whitelist ({rules.data.mimeWhitelist.length} entries)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {rules.data.mimeWhitelist.map((m) => (
                    <Badge
                      key={m}
                      variant="outline"
                      className="max-w-full whitespace-normal break-all font-mono text-xs"
                    >
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs text-white/40">Max File Size</p>
                <p className="font-mono text-sm text-brand-400">
                  {(rules.data.maxSizeBytes / (1024 * 1024)).toFixed(0)} MiB
                </p>
              </div>
              {rules.data.customValidators.length > 0 && (
                <div>
                  <p className="mb-2 text-xs text-white/40">Custom Validators</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rules.data.customValidators.map((v) => (
                      <Badge key={v} variant="default" className="text-xs">
                        {v}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Shared whitelist constants */}
      <Card>
        <CardHeader accent>
          <CardTitle>Shared Constants</CardTitle>
          <CardDescription>
            These whitelist constants are imported from{' '}
            <code className="font-mono text-brand-400">@bymax-one/nest-storage/shared</code> — the
            same values the server uses, rendering in the browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs text-white/40">DEFAULT_IMAGE_MIME_WHITELIST</p>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_IMAGE_MIME_WHITELIST.map((m) => (
                <Badge
                  key={m}
                  variant="outline"
                  className="max-w-full whitespace-normal break-all font-mono text-xs"
                >
                  {m}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs text-white/40">DEFAULT_DOC_MIME_WHITELIST</p>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_DOC_MIME_WHITELIST.map((m) => (
                <Badge
                  key={m}
                  variant="outline"
                  className="max-w-full whitespace-normal break-all font-mono text-xs"
                >
                  {m}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Failure triggers */}
      <Card>
        <CardHeader accent>
          <CardTitle>Failure Path Demos</CardTitle>
          <CardDescription>
            Each button triggers a specific validation failure so you can see the library envelope.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'MIME rejected (ZIP)',
                action: triggerMimeRejection,
                expected: 'STORAGE_MIME_NOT_ALLOWED',
              },
              {
                label: 'Size exceeded (30 MiB)',
                action: triggerSizeRejection,
                expected: 'STORAGE_SIZE_EXCEEDED',
              },
              {
                label: 'Magic-byte forgery (fake PDF)',
                action: triggerMagicByteRejection,
                expected: 'STORAGE_VALIDATION_FAILED',
              },
              { label: 'Clean upload (1-px PNG)', action: triggerCleanUpload, expected: 'success' },
            ].map(({ label, action, expected }) => (
              <button
                key={label}
                type="button"
                onClick={() => void action()}
                className="min-w-0 rounded-xl border border-(--glass-border) bg-(--glass-bg) p-3 text-left transition-all hover:border-brand-500/30 hover:bg-brand-500/5"
              >
                <p className="text-sm font-medium">{label}</p>
                <p className="mt-1 font-mono text-xs break-all text-white/40">{expected}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Envelope or success */}
      {envelope && <EnvelopePanel envelope={envelope} />}
      {lastResult && (
        <Card>
          <CardContent className="pt-4 font-mono text-xs space-y-1">
            <p className="text-green-400 font-semibold">Upload passed validation</p>
            <p className="text-white/60">key: {lastResult.key}</p>
            <p className="text-white/60">size: {lastResult.size}</p>
            <p className="text-white/60">contentType: {lastResult.contentType}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
