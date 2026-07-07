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
  it('renders the hex table with offset, hex, and ASCII columns', () => {
    // 'ABCD' = 0x41 0x42 0x43 0x44 in base64 = QUJDRA==
    render(<HexPreview base64="QUJDRA==" />)
    const table = screen.getByRole('table', { name: /hex dump/i })
    expect(table).toBeInTheDocument()
    // First row offset
    expect(screen.getByText('00000000')).toBeInTheDocument()
    // ASCII representation
    expect(screen.getByText('ABCD')).toBeInTheDocument()
  })

  it('renders multiple rows for data > 16 bytes', () => {
    // 32 bytes = 2 rows; generate 32 zero bytes encoded
    const bytes = new Uint8Array(32)
    const binaryStr = String.fromCharCode(...bytes)
    const base64 = btoa(binaryStr)
    render(<HexPreview base64={base64} />)
    // Second row offset = 16 = 0x10
    expect(screen.getByText('00000010')).toBeInTheDocument()
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
