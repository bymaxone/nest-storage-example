/**
 * @fileoverview Unit and render tests for HexPreview.
 * @layer components/vault/HexPreview.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HexPreview, decodeBase64, formatOffset } from './HexPreview'

describe('decodeBase64', () => {
  it('decodes a known base64 string', () => {
    // 'Hello' in base64 is 'SGVsbG8='
    const result = decodeBase64('SGVsbG8=')
    expect(result).toBeInstanceOf(Uint8Array)
    expect(Array.from(result)).toEqual([72, 101, 108, 108, 111])
  })

  it('decodes an empty string', () => {
    const result = decodeBase64('')
    expect(result).toHaveLength(0)
  })
})

describe('formatOffset', () => {
  it('formats 0 as 00000000', () => {
    expect(formatOffset(0)).toBe('00000000')
  })

  it('formats 16 as 00000010', () => {
    expect(formatOffset(16)).toBe('00000010')
  })

  it('formats 255 as 000000FF', () => {
    expect(formatOffset(255)).toBe('000000FF')
  })

  it('formats 4096 as 00001000', () => {
    expect(formatOffset(4096)).toBe('00001000')
  })
})

describe('HexPreview', () => {
  /** Encodes a byte array as base64 for HexPreview input. */
  function b64(bytes: number[]): string {
    return btoa(String.fromCharCode(...bytes))
  }

  it('renders the hex table with offset, hex, and ASCII columns', () => {
    // 'ABCD' = 0x41 0x42 0x43 0x44 in base64 = QUJDRA==
    const { container } = render(<HexPreview base64="QUJDRA==" />)
    const table = screen.getByRole('table', { name: /hex dump/i })
    expect(table).toBeInTheDocument()
    // First row offset
    expect(screen.getByText('00000000')).toBeInTheDocument()
    // ASCII representation
    expect(screen.getByText('ABCD')).toBeInTheDocument()
    // The wrapper keeps its scroll container classes.
    expect((container.firstChild as HTMLElement).className).toContain('rounded-lg')
    // A short buffer under maxBytes shows no truncation notice.
    expect(screen.queryByText(/Showing first/)).not.toBeInTheDocument()
  })

  it('renders uppercase, zero-padded, space-joined hex bytes', () => {
    // Bytes 0x05, 0xAB, 0x41 exercise zero padding, the A–F case, and spacing.
    const { container } = render(<HexPreview base64={b64([0x05, 0xab, 0x41])} />)
    const hexCell = container.querySelector('td[class*="text-brand-300"]')
    expect(hexCell?.textContent).toContain('05 AB 41')
  })

  it('renders the ASCII column with printable-range boundaries', () => {
    // 5 = control (.), 32 = space (printable), 65 = 'A', 127 = DEL (.), 171 = high (.)
    const { container } = render(<HexPreview base64={b64([5, 32, 65, 127, 171])} />)
    const asciiCell = container.querySelector('td[class*="text-white/70"]')
    expect(asciiCell?.textContent).toBe('. A..')
  })

  it('slices bytes into 16-byte rows rather than repeating the whole buffer', () => {
    // 16 'A' then 16 'B': the first row's ASCII must be exactly 16 'A's, proving
    // each row is a 16-byte slice (not the full buffer).
    const bytes = [...Array.from({ length: 16 }, () => 65), ...Array.from({ length: 16 }, () => 66)]
    render(<HexPreview base64={b64(bytes)} />)
    expect(screen.getByText('A'.repeat(16))).toBeInTheDocument()
    expect(screen.getByText('B'.repeat(16))).toBeInTheDocument()
  })

  it('renders multiple rows for data > 16 bytes', () => {
    // 32 bytes = 2 rows; generate 32 zero bytes encoded
    const bytes = new Uint8Array(32)
    const binaryStr = String.fromCharCode(...bytes)
    const base64 = btoa(binaryStr)
    const { container } = render(<HexPreview base64={base64} />)
    // Second row offset = 16 = 0x10
    expect(screen.getByText('00000010')).toBeInTheDocument()
    // Exactly two rows — the row loop stops at bytes.length (no trailing empty row).
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('shows truncation notice when data exceeds maxBytes', () => {
    // 20 bytes, maxBytes=16 → truncation
    const bytes = new Uint8Array(20).fill(65) // 'A' x 20
    const binaryStr = String.fromCharCode(...bytes)
    const base64 = btoa(binaryStr)
    render(<HexPreview base64={base64} maxBytes={16} />)
    expect(screen.getByText(/Showing first 16 bytes only/)).toBeInTheDocument()
  })

  it('renders error message for invalid base64', () => {
    render(<HexPreview base64="NOT_VALID_BASE64!!!" />)
    expect(screen.getByText(/Failed to decode hex preview data/)).toBeInTheDocument()
  })

  it('renders non-printable bytes as dots in ASCII column', () => {
    // Null bytes (0x00) render as '.'
    const bytes = new Uint8Array(4) // 4 null bytes
    const binaryStr = String.fromCharCode(...bytes)
    const base64 = btoa(binaryStr)
    render(<HexPreview base64={base64} />)
    // ASCII column shows '....' for 4 null bytes
    expect(screen.getByText('....')).toBeInTheDocument()
  })
})
