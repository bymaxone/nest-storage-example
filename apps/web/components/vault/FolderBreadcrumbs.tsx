/**
 * @fileoverview Folder breadcrumb trail for the vault browser. Parses a
 * storage prefix string (e.g. `"foo/bar/"`) into clickable path segments so
 * users can navigate up the delimiter-based folder hierarchy.
 *
 * @module components/vault/FolderBreadcrumbs
 */

import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FolderBreadcrumbsProps {
  /** Current prefix, e.g. `"images/2024/"`. Empty string means root. */
  prefix: string
  /** Called when the user clicks a segment; receives the new prefix. */
  onNavigate: (prefix: string) => void
  /** Optional extra class names. */
  className?: string
}

/** Parsed crumb: its label and the full prefix that selects it. */
interface Crumb {
  label: string
  prefix: string
}

/**
 * Parses a prefix string into an ordered list of breadcrumb segments.
 * The root always appears first as an empty-prefix home entry.
 *
 * @param prefix - The full prefix string, e.g. `"docs/2024/"`.
 * @returns Ordered crumbs from root to the current segment.
 */
export function parsePrefixToCrumbs(prefix: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'root', prefix: '' }]
  if (!prefix) return crumbs
  // Split on '/' keeping only non-empty segments
  const parts = prefix.split('/').filter((p) => p.length > 0)
  let accumulated = ''
  for (const part of parts) {
    accumulated += `${part}/`
    crumbs.push({ label: part, prefix: accumulated })
  }
  return crumbs
}

/**
 * Renders a clickable breadcrumb trail derived from a storage object prefix.
 * Each segment navigates to its corresponding sub-prefix.
 *
 * @param prefix - Current storage prefix string.
 * @param onNavigate - Navigation callback.
 * @param className - Optional extra class names.
 */
export function FolderBreadcrumbs({ prefix, onNavigate, className }: FolderBreadcrumbsProps) {
  const crumbs = parsePrefixToCrumbs(prefix)

  return (
    <nav
      aria-label="Folder path"
      className={cn('flex items-center gap-1 font-mono text-sm', className)}
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={crumb.prefix} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-white/30" aria-hidden="true" />}
            {crumb.label === 'root' ? (
              <button
                type="button"
                onClick={() => onNavigate('')}
                className={cn(
                  'flex items-center gap-1 rounded px-1 py-0.5 transition-colors',
                  isLast ? 'text-brand-500' : 'text-white/50 hover:text-white/80',
                )}
                aria-current={isLast ? 'page' : undefined}
              >
                <Home className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(crumb.prefix)}
                className={cn(
                  'rounded px-1 py-0.5 transition-colors',
                  isLast ? 'text-brand-500 font-semibold' : 'text-white/50 hover:text-white/80',
                )}
                aria-current={isLast ? 'page' : undefined}
              >
                {crumb.label}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}
