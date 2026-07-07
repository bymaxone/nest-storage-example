/**
 * @fileoverview Direct upload client content — issue a presigned PUT URL,
 * display the required-headers inspector, perform the browser XHR PUT with
 * progress, and confirm the upload with a server-side verify step.
 *
 * @layer app/direct/direct-upload-content
 */

'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { CheckCircle, AlertTriangle } from 'lucide-react'
import { useSignedUploadUrl, useConfirmUpload } from '@/hooks/use-signed'
import { putWithHeaders } from '@/lib/direct-upload'
import { UploadDropzone } from '@/components/transfer/UploadDropzone'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ConfirmResult } from '@/hooks/use-signed'

type Step = 'idle' | 'issued' | 'uploading' | 'confirming' | 'done'

/** Upper bound (25 MiB) enforced by the presigned PUT length policy for the demo. */
const MAX_DIRECT_UPLOAD_BYTES = 25 * 1024 * 1024

/** TTL (seconds) requested for the demo presigned PUT URL. */
const DIRECT_UPLOAD_TTL_SECONDS = 300

interface UploadUrlResponse {
  url: string
  expiresAt: string
  key: string
  requiredHeaders: Record<string, string>
  method: 'PUT'
  requestedTtl: number
  effectiveTtl: number
}

/** Direct upload flow: issue → PUT → confirm. */
export function DirectUploadContent() {
  const [step, setStep] = useState<Step>('idle')
  const [issued, setIssued] = useState<UploadUrlResponse | null>(null)
  const [progress, setProgress] = useState<{ loaded: number; total: number } | undefined>()
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const issueUrl = useSignedUploadUrl()
  const confirm = useConfirmUpload()

  const handleFileSelect = useCallback(
    async (file: File) => {
      setSelectedFile(file)
      setStep('idle')
      try {
        const result = await issueUrl.mutateAsync({
          key: `direct/${file.name}`,
          contentType: file.type || 'application/octet-stream',
          ttlSeconds: DIRECT_UPLOAD_TTL_SECONDS,
          maxSizeBytes: MAX_DIRECT_UPLOAD_BYTES,
        })
        setIssued(result)
        setStep('issued')
        toast.success('Signed URL issued')
      } catch (e) {
        toast.error(`Issue failed: ${(e as Error).message}`)
        setStep('idle')
      }
    },
    [issueUrl],
  )

  const handlePut = useCallback(async () => {
    if (!issued || !selectedFile) return
    setStep('uploading')
    setProgress({ loaded: 0, total: selectedFile.size })
    try {
      await putWithHeaders(issued.url, issued.requiredHeaders, selectedFile, (loaded, total) =>
        setProgress({ loaded, total }),
      )
      toast.success('PUT complete — confirming…')
      setStep('confirming')
      const r = await confirm.mutateAsync(issued.key)
      setConfirmResult(r)
      setStep('done')
      toast.success(`Confirm: ${r.scanVerdict ?? 'no verdict'}`)
    } catch (e) {
      toast.error(`Direct upload failed: ${(e as Error).message}`)
      setStep('issued')
    }
  }, [issued, selectedFile, confirm])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono text-2xl font-bold">Direct Upload</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browser PUT directly to MinIO via a presigned URL — bypasses local validation. The confirm
          step enforces size/MIME and runs the scanner.
        </p>
      </div>

      {/* Validation-bypass banner */}
      <div className="flex items-start gap-3 rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3 text-sm text-yellow-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Signed PUT bypasses local validation by design. The confirm step (
          <code className="font-mono text-yellow-400">POST /signed/confirm</code>) re-applies size
          limits and runs the scanner. Always confirm direct uploads before trusting the object.
        </p>
      </div>

      {/* Step 1 — Select file and issue URL */}
      <Card>
        <CardHeader accent>
          <CardTitle>Step 1 — Issue Signed PUT URL</CardTitle>
          <CardDescription>
            Drop a file to issue a presigned URL for it. The server returns{' '}
            <code className="font-mono text-brand-400">requiredHeaders</code> that must be sent
            verbatim with the PUT.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadDropzone onFile={handleFileSelect} isPending={issueUrl.isPending} />
        </CardContent>
      </Card>

      {/* Required headers inspector */}
      {issued && (
        <Card>
          <CardHeader accent>
            <CardTitle>Required Headers Inspector</CardTitle>
            <CardDescription>
              These headers are part of the SigV4 signature and MUST be sent verbatim with the PUT.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="border-b border-(--glass-border) text-white/40">
                  <th className="pb-2 text-left font-normal">Header</th>
                  <th className="pb-2 text-left font-normal">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(issued.requiredHeaders).map(([k, v]) => (
                  <tr key={k} className="border-b border-(--glass-border) last:border-0">
                    <td className="py-1.5 pr-4 text-brand-300">{k}</td>
                    <td className="py-1.5 text-white/70">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — PUT */}
      {step === 'issued' && issued && selectedFile && (
        <Card>
          <CardHeader accent>
            <CardTitle>Step 2 — PUT to Storage</CardTitle>
            <CardDescription>
              Send <strong>{selectedFile.name}</strong> directly to MinIO using the issued URL and
              required headers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void handlePut()}>PUT {selectedFile.name}</Button>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      {step === 'uploading' && progress && (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-2">
              <div className="flex justify-between font-mono text-xs text-white/60">
                <span>Uploading…</span>
                <span>{Math.round((progress.loaded / (progress.total || 1)) * 100)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{
                    width: `${Math.round((progress.loaded / (progress.total || 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Confirm result */}
      {step === 'done' && confirmResult && (
        <Card>
          <CardHeader accent>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              Step 3 — Confirm Result
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xs space-y-1">
            <Row
              label="Key"
              value={confirmResult.exists !== undefined ? String(confirmResult.exists) : '—'}
            />
            <Row label="Scan verdict" value={confirmResult.scanVerdict ?? '—'} />
            {confirmResult.metadata && (
              <>
                <Row label="Size" value={String(confirmResult.metadata.size)} />
                <Row label="Content-Type" value={confirmResult.metadata.contentType} />
                <Row label="ETag" value={confirmResult.metadata.etag} />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-28 text-white/40">{label}</span>
      <span className="text-white/80">{value}</span>
    </div>
  )
}
