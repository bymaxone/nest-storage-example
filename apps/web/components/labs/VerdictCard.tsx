/**
 * @fileoverview Scanner verdict card. Renders a clean/infected/unknown verdict
 * with contextual colour, icon, and optional threat metadata.
 *
 * @module components/labs/VerdictCard
 */

import { ShieldCheck, ShieldX, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** The three possible scanner verdicts. */
export type Verdict = 'clean' | 'infected' | 'unknown'

interface VerdictCardProps {
  /** Scanner verdict. */
  verdict: Verdict
  /** Threat name when the verdict is `infected`. */
  threat?: string
  /** Optional description or context shown below the verdict. */
  description?: string
  /** Optional extra class names. */
  className?: string
}

/**
 * Resolves the display properties for a given verdict.
 *
 * @param verdict - The scanner verdict.
 * @returns Icon component, colour classes, and label.
 */
export function verdictDisplay(verdict: Verdict) {
  if (verdict === 'clean') {
    return {
      Icon: ShieldCheck,
      color: 'text-green-400',
      border: 'border-green-400/20',
      bg: 'bg-green-400/5',
      label: 'Clean',
    }
  }
  if (verdict === 'infected') {
    return {
      Icon: ShieldX,
      color: 'text-red-400',
      border: 'border-red-400/20',
      bg: 'bg-red-400/5',
      label: 'Infected',
    }
  }
  return {
    Icon: ShieldAlert,
    color: 'text-yellow-400',
    border: 'border-yellow-400/20',
    bg: 'bg-yellow-400/5',
    label: 'Unknown',
  }
}

/**
 * Displays the outcome of a file scan with colour-coded visual cues.
 * - Green shield: clean
 * - Red shield: infected (threat name shown if available)
 * - Yellow shield: unknown/inconclusive
 *
 * @param verdict - Scanner verdict.
 * @param threat - Threat name (infected only).
 * @param description - Optional context text.
 * @param className - Optional class names.
 */
export function VerdictCard({ verdict, threat, description, className }: VerdictCardProps) {
  const { Icon, color, border, bg, label } = verdictDisplay(verdict)
  return (
    <Card className={cn(border, bg, className)}>
      <CardHeader className="pb-2">
        <CardTitle className={cn('flex items-center gap-2 text-base', color)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {threat && (
          <p className="mb-1 font-mono text-xs text-red-300">
            Threat: <span className="font-semibold">{threat}</span>
          </p>
        )}
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  )
}
