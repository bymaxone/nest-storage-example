/**
 * @fileoverview Status-to-display-properties mapping for health chips and
 * verdict cards. Derived from the API health response and scanner verdicts.
 * @layer lib/storage-status
 */

/** Visual representation of a storage health status. */
export interface StatusDisplay {
  /** Tailwind text colour class for the status. */
  color: string
  /** Dot indicator Tailwind background class. */
  dot: string
  /** Human-readable label shown in chips. */
  label: string
}

/** Maps an API health status string to display properties. */
export function healthStatusDisplay(status: string): StatusDisplay {
  if (status === 'up') {
    return { color: 'text-green-400', dot: 'bg-green-400', label: 'Healthy' }
  }
  if (status === 'degraded') {
    return { color: 'text-yellow-400', dot: 'bg-yellow-400', label: 'Degraded' }
  }
  return { color: 'text-red-400', dot: 'bg-red-400', label: 'Unavailable' }
}

/** Maps a scanner verdict string to display properties. */
export function verdictStatusDisplay(verdict: string): StatusDisplay {
  if (verdict === 'clean') {
    return { color: 'text-green-400', dot: 'bg-green-400', label: 'Clean' }
  }
  if (verdict === 'infected') {
    return { color: 'text-red-400', dot: 'bg-red-400', label: 'Infected' }
  }
  return { color: 'text-yellow-400', dot: 'bg-yellow-400', label: 'Unknown' }
}

/** Maps an HTTP status code to a colour class for envelope panels. */
export function httpStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-400'
  if (status >= 400 && status < 500) return 'text-yellow-400'
  return 'text-red-400'
}
