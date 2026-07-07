/**
 * @fileoverview Typed error envelope panel. Renders a `StorageErrorResponse`
 * (or an `ApiRequestError`) with the HTTP status, error code, message, and
 * optional details tree — all keyed against `STORAGE_ERROR_CODES`.
 *
 * @module components/labs/EnvelopePanel
 */

import { AlertTriangle } from 'lucide-react'
import { STORAGE_ERROR_CODES } from '@bymax-one/nest-storage/shared'
import { cn } from '@/lib/utils'
import { httpStatusColor } from '@/lib/storage-status'

/** All known storage error codes for badge rendering. */
const KNOWN_CODES = new Set<string>(Object.values(STORAGE_ERROR_CODES))

/** Typed envelope panel data — mirrors the library's error response shape. */
export interface EnvelopePanelData {
  /** HTTP status code. */
  httpStatus: number
  /** Storage error code from STORAGE_ERROR_CODES, or 'UNKNOWN'. */
  code: string
  /** Human-readable error message. */
  message: string
  /** Optional structured details from the library. */
  details?: Record<string, unknown>
}

interface EnvelopePanelProps {
  /** The error to display. */
  envelope: EnvelopePanelData
  /** Optional extra class names. */
  className?: string
}

/**
 * Renders a storage error response envelope with status, code, message, and
 * details. Error codes known to STORAGE_ERROR_CODES are highlighted as a
 * brand badge; unknown codes render in muted style.
 *
 * @param envelope - The error envelope to display.
 * @param className - Optional extra class names.
 */
export function EnvelopePanel({ envelope, className }: EnvelopePanelProps) {
  const { httpStatus, code, message, details } = envelope
  const isKnownCode = KNOWN_CODES.has(code)
  const statusColor = httpStatusColor(httpStatus)

  return (
    <div
      className={cn(
        'rounded-xl border border-(--glass-border) bg-(--glass-card-bg) p-4 font-mono text-sm',
        className,
      )}
      role="alert"
      aria-label={`Error: ${code}`}
    >
      {/* Header row: HTTP status + code badge */}
      <div className="mb-3 flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
        <span className={cn('text-lg font-bold tabular-nums', statusColor)}>{httpStatus}</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs',
            isKnownCode
              ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
              : 'bg-white/5 text-white/50 border border-white/10',
          )}
        >
          {code}
        </span>
      </div>

      {/* Message */}
      <p className="mb-3 text-white/80">{message}</p>

      {/* Details tree */}
      {details && Object.keys(details).length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none text-xs text-white/40 hover:text-white/60">
            Details ▸
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-black/30 p-3 text-xs text-white/60 whitespace-pre-wrap">
            {JSON.stringify(details, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}
