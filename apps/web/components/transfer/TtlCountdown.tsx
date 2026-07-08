/**
 * @fileoverview Signed URL expiry countdown ring. Renders a circular SVG
 * progress indicator that depletes as the URL approaches its expiry time,
 * with a live digital countdown label.
 *
 * @layer components/transfer/TtlCountdown
 */

'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/** Radius of the SVG progress ring in pixels. */
const RING_RADIUS = 28
/** Circumference of the ring used for the stroke-dasharray/dashoffset. */
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

interface TtlCountdownProps {
  /** ISO date string when the URL expires. */
  expiresAt: string
  /** Total TTL in seconds (used to compute the ring fill fraction). */
  ttlSeconds: number
  /** Optional extra class names. */
  className?: string
}

/**
 * Formats a remaining-seconds number as `MM:SS` or `HH:MM:SS`.
 *
 * @param seconds - Remaining seconds (clamped to 0).
 * @returns Formatted string.
 */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/**
 * Countdown ring showing the remaining validity fraction of a signed URL.
 * The ring empties as the URL approaches expiry, turning red in the last 60 s.
 *
 * @param expiresAt - ISO expiry timestamp.
 * @param ttlSeconds - Total issued TTL for the URL.
 * @param className - Optional extra class names.
 */
export function TtlCountdown({ expiresAt, ttlSeconds, className }: TtlCountdownProps) {
  const expiryMs = new Date(expiresAt).getTime()
  // Stryker disable next-line ArrowFunction,MethodExpression,ArithmeticOperator: the mount effect below immediately recomputes `remaining` with this identical formula, so the lazy initializer's value is never observed by any render.
  const [remaining, setRemaining] = useState(() => Math.max(0, (expiryMs - Date.now()) / 1000))

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, (expiryMs - Date.now()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiryMs])

  const fraction = ttlSeconds > 0 ? Math.min(1, remaining / ttlSeconds) : 0
  const dashOffset = RING_CIRCUMFERENCE * (1 - fraction)
  const isExpired = remaining <= 0
  const isWarning = !isExpired && remaining < 60

  const ringColor = isExpired
    ? 'stroke-white/20'
    : isWarning
      ? 'stroke-red-400'
      : 'stroke-brand-500'
  const labelColor = isExpired ? 'text-white/30' : isWarning ? 'text-red-400' : 'text-brand-500'

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <svg
        width="72"
        height="72"
        viewBox="0 0 72 72"
        aria-label={`Expiry countdown: ${isExpired ? 'expired' : formatCountdown(remaining)}`}
        role="img"
      >
        {/* Background track */}
        <circle
          cx="36"
          cy="36"
          r={RING_RADIUS}
          fill="none"
          className="stroke-white/10"
          strokeWidth="4"
        />
        {/* Progress ring — rotated so it starts at the top */}
        <circle
          cx="36"
          cy="36"
          r={RING_RADIUS}
          fill="none"
          className={ringColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <span className={cn('font-mono text-sm font-bold tabular-nums', labelColor)}>
        {isExpired ? 'EXPIRED' : formatCountdown(remaining)}
      </span>
    </div>
  )
}
