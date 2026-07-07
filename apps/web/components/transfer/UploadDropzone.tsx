/**
 * @fileoverview Upload dropzone with strategy indicator and progress bar.
 * Accepts file drops and click-to-browse; posts to the API and shows the
 * upload result including the multipart strategy flag.
 *
 * @module components/transfer/UploadDropzone
 */

'use client'

import { useRef, useState, useCallback, type DragEvent, type ChangeEvent } from 'react'
import { Upload, File } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

/** Strategy derived from the UploadResult. */
export type UploadStrategy = 'single' | 'multipart' | 'idle'

/** Progress tracking for an in-flight upload. */
export interface UploadProgress {
  /** Bytes uploaded so far. */
  loaded: number
  /** Total file size in bytes. */
  total: number
}

interface UploadDropzoneProps {
  /** Called when the user selects a file for upload. */
  onFile: (file: File) => void | Promise<void>
  /** Upload progress (undefined when no upload is in progress). */
  progress?: UploadProgress
  /** Strategy reported by the last upload result. */
  strategy?: UploadStrategy
  /** Whether an upload is in progress. */
  isPending?: boolean
  /** Optional extra class names. */
  className?: string
}

/**
 * Formats bytes into a human-readable size string.
 *
 * @param bytes - Raw byte count.
 * @returns Formatted string like `1.2 MB`.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * Derives the upload strategy label from the multipart flag.
 *
 * @param multipart - True when the library chose the multipart path.
 * @returns Strategy string.
 */
export function strategyFromMultipart(multipart: boolean): UploadStrategy {
  return multipart ? 'multipart' : 'single'
}

/**
 * Drag-and-drop upload zone with strategy chip and progress bar.
 * Fires `onFile` with the selected File; the parent handles the actual
 * upload mutation and reports progress/strategy back as props.
 */
export function UploadDropzone({
  onFile,
  progress,
  strategy = 'idle',
  isPending = false,
  className,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) void onFile(file)
    },
    [onFile],
  )

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void onFile(file)
      // Reset so the same file can be re-selected
      e.target.value = ''
    },
    [onFile],
  )

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.loaded / progress.total) * 100)
      : undefined

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload dropzone — click or drag a file here"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 transition-all',
          isDragging
            ? 'border-brand-500 bg-brand-500/5'
            : 'border-(--glass-border) bg-(--glass-bg) hover:border-brand-500/40 hover:bg-brand-500/3',
          isPending && 'pointer-events-none opacity-60',
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/15">
          {isPending ? (
            <File className="h-6 w-6 text-brand-500" aria-hidden="true" />
          ) : (
            <Upload className="h-6 w-6 text-brand-500" aria-hidden="true" />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {isPending ? 'Uploading…' : 'Drop a file or click to browse'}
          </p>
          <p className="text-xs text-muted-foreground">Any file type accepted by the server</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={handleChange}
        aria-hidden="true"
      />

      {/* Strategy + progress row */}
      {strategy !== 'idle' && (
        <div className="flex items-center gap-3">
          <Badge variant={strategy === 'multipart' ? 'default' : 'outline'}>
            {strategy === 'multipart' ? 'Multipart' : 'Single-shot'}
          </Badge>
          {progressPercent !== undefined && (
            <span className="font-mono text-xs text-muted-foreground">{progressPercent}%</span>
          )}
        </div>
      )}

      {/* Progress bar */}
      {progressPercent !== undefined && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Upload progress"
        >
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  )
}
