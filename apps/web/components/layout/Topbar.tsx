/**
 * @fileoverview Fixed 64px dark-glass top bar — brand identity + health status chip.
 *
 * Shows the orange-bordered stacked-layers brand mark and the gradient
 * `nest-storage-example` wordmark on the left. The right cluster renders a
 * health status chip that polls `GET /health`, a hamburger for mobile sidebar.
 *
 * @layer components/layout/Topbar
 */

'use client'

import type { ReactNode } from 'react'
import { Menu, Circle } from 'lucide-react'
import { useHealth } from '@/hooks/use-health'

/** Poll interval (ms) for the topbar health chip. */
const HEALTH_POLL_INTERVAL_MS = 30_000

interface TopbarProps {
  /** Called when the hamburger is pressed to open the mobile sidebar. */
  onMenuOpen?: () => void
  /** Optional override for the right slot. */
  right?: ReactNode
}

/** Fixed 64px dark-glass top bar — brand identity (left) + health chip + mobile hamburger. */
export function Topbar({ onMenuOpen, right }: TopbarProps) {
  const health = useHealth(HEALTH_POLL_INTERVAL_MS)

  const chipColor = health.isLoading
    ? 'text-white/40'
    : health.isError
      ? 'text-red-400'
      : 'text-green-400'

  const chipLabel = health.isLoading
    ? 'checking…'
    : health.isError
      ? 'offline'
      : `online · ${String(health.data?.latencyMs ?? 0)} ms`

  return (
    <header className="fixed left-0 right-0 top-0 z-200 flex h-16 items-center justify-between border-b border-white/7 bg-black/85 px-4 backdrop-blur-md lg:px-6">
      {/* ── Left: brand mark + wordmark ── */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-500/40 bg-brand-500/15"
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="var(--color-brand-500)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="select-none bg-linear-to-r from-brand-500 to-amber-200 bg-clip-text font-mono text-sm font-bold leading-tight text-transparent">
          nest-storage-example
        </span>
      </div>

      {/* ── Right: health chip + optional slot + hamburger ── */}
      <div className="flex items-center gap-2">
        <div
          className={`hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs md:flex ${chipColor}`}
        >
          <Circle className="h-2 w-2 fill-current" aria-hidden="true" />
          <span>{chipLabel}</span>
        </div>
        {right ? <div className="hidden items-center gap-2 md:flex">{right}</div> : null}
        <button
          type="button"
          aria-label="Open navigation menu"
          onClick={onMenuOpen}
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/5 lg:hidden"
        >
          <Menu className="h-4 w-4 text-white/70" />
        </button>
      </div>
    </header>
  )
}
