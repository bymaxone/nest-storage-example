/**
 * @fileoverview Hex dump panel for the vault detail drawer. Decodes a base64
 * byte string and renders it as a hex/ASCII side-by-side table, matching the
 * classic hex editor format in 16-byte rows.
 *
 * @module components/vault/HexPreview
 */

import { cn } from '@/lib/utils'

/** Number of bytes displayed per row in the hex view. */
const BYTES_PER_ROW = 16

interface HexPreviewProps {
  /**
   * Base64-encoded bytes to render. Only the first `maxBytes` bytes are
   * shown to avoid overwhelming the panel.
   */
  base64: string
  /** Maximum bytes to render (defaults to 256). */
  maxBytes?: number
  /** Optional extra class names for the wrapper. */
  className?: string
}

/**
 * Decodes a base64 string into a Uint8Array suitable for hex rendering.
 *
 * @param base64 - Standard base64 string (may contain padding).
 * @returns Decoded bytes.
 */
export function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Formats an offset integer as an 8-digit uppercase hex string with leading
 * zeros (e.g. `00000010`).
 *
 * @param offset - Byte offset.
 * @returns Formatted offset string.
 */
export function formatOffset(offset: number): string {
  return offset.toString(16).padStart(8, '0').toUpperCase()
}

/**
 * Renders a hex dump of the given base64 bytes as a monospace table with
 * offset, hex, and ASCII columns.
 */
export function HexPreview({ base64, maxBytes = 256, className }: HexPreviewProps) {
  let bytes: Uint8Array
  try {
    bytes = decodeBase64(base64).slice(0, maxBytes)
  } catch {
    return <p className="font-mono text-xs text-red-400">Failed to decode hex preview data.</p>
  }

  const rows: Array<{ offset: number; chunk: Uint8Array }> = []
  for (let i = 0; i < bytes.length; i += BYTES_PER_ROW) {
    rows.push({ offset: i, chunk: bytes.slice(i, i + BYTES_PER_ROW) })
  }

  return (
    <div className={cn('overflow-x-auto rounded-lg bg-black/30 p-3', className)}>
      <table className="font-mono text-xs" aria-label="Hex dump">
        <thead>
          <tr className="text-white/30">
            <th className="pr-4 text-left font-normal">Offset</th>
            <th className="pr-4 text-left font-normal">Hex</th>
            <th className="text-left font-normal">ASCII</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ offset, chunk }) => {
            const hex = Array.from(chunk)
              .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
              .join(' ')
            // Pad the last row to keep alignment
            const paddedHex = hex.padEnd(BYTES_PER_ROW * 3 - 1, ' ')
            const ascii = Array.from(chunk)
              .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.'))
              .join('')

            return (
              <tr key={offset} className="leading-relaxed">
                <td className="pr-4 text-white/40">{formatOffset(offset)}</td>
                <td className="pr-4 text-brand-300">{paddedHex}</td>
                <td className="text-white/70">{ascii}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {bytes.length === maxBytes && (
        <p className="mt-2 text-xs text-white/30">Showing first {maxBytes} bytes only.</p>
      )}
    </div>
  )
}
