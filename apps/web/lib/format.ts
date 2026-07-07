/**
 * @fileoverview Human-readable formatting helpers shared across the dashboard
 * (byte sizes, dates). Single source of truth so every page renders sizes and
 * timestamps identically.
 * @layer lib/format
 */

/**
 * Formats a raw byte count into a human-readable size string.
 *
 * @param bytes - Raw byte count.
 * @returns Formatted string such as `1.2 MB`.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * Formats a date-like value to a locale string.
 *
 * @param value - A Date instance or an ISO date string.
 * @returns The locale-formatted date-time string.
 */
export function formatDate(value: Date | string): string {
  return new Date(value).toLocaleString()
}
