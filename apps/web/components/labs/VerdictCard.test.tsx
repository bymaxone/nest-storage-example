/**
 * @fileoverview Unit and render tests for VerdictCard.
 * @layer components/labs/VerdictCard.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VerdictCard, verdictDisplay } from './VerdictCard'
import { ShieldCheck, ShieldX, ShieldAlert } from 'lucide-react'

describe('verdictDisplay', () => {
  it('returns green ShieldCheck for clean', () => {
    const d = verdictDisplay('clean')
    expect(d.Icon).toBe(ShieldCheck)
    expect(d.label).toBe('Clean')
    expect(d.color).toContain('green')
  })

  it('returns red ShieldX for infected', () => {
    const d = verdictDisplay('infected')
    expect(d.Icon).toBe(ShieldX)
    expect(d.label).toBe('Infected')
    expect(d.color).toContain('red')
  })

  it('returns yellow ShieldAlert for unknown', () => {
    const d = verdictDisplay('unknown')
    expect(d.Icon).toBe(ShieldAlert)
    expect(d.label).toBe('Unknown')
    expect(d.color).toContain('yellow')
  })

  // Scenario: each verdict carries the exact border and background classes.
  it('returns the exact green border and background for clean', () => {
    const d = verdictDisplay('clean')
    expect(d.border).toBe('border-green-400/20')
    expect(d.bg).toBe('bg-green-400/5')
  })

  it('returns the exact red border and background for infected', () => {
    const d = verdictDisplay('infected')
    expect(d.border).toBe('border-red-400/20')
    expect(d.bg).toBe('bg-red-400/5')
  })

  it('returns the exact yellow border and background for unknown', () => {
    const d = verdictDisplay('unknown')
    expect(d.border).toBe('border-yellow-400/20')
    expect(d.bg).toBe('bg-yellow-400/5')
  })
})

describe('VerdictCard', () => {
  it('renders clean verdict', () => {
    render(<VerdictCard verdict="clean" />)
    expect(screen.getByText('Clean')).toBeInTheDocument()
  })

  it('renders infected verdict with threat name', () => {
    render(<VerdictCard verdict="infected" threat="EICAR-Test-Signature" />)
    expect(screen.getByText('Infected')).toBeInTheDocument()
    expect(screen.getByText('EICAR-Test-Signature')).toBeInTheDocument()
  })

  it('renders unknown verdict', () => {
    render(<VerdictCard verdict="unknown" />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<VerdictCard verdict="clean" description="Engine: MarkerFileScanner" />)
    const desc = screen.getByText('Engine: MarkerFileScanner')
    expect(desc).toBeInTheDocument()
    // The description must render inside its own muted paragraph, proving the
    // `description && <p>` render guard (a `||` swap would emit a bare text node).
    expect(desc.tagName).toBe('P')
    expect(desc.className).toContain('text-muted-foreground')
  })

  // Scenario: the verdict title carries the layout + colour classes from `cn`.
  it('renders the verdict title with its layout classes', () => {
    render(<VerdictCard verdict="clean" />)
    const title = screen.getByText('Clean')
    expect(title.className).toContain('items-center')
    expect(title.className).toContain('text-base')
  })

  it('does not render threat section when threat is absent', () => {
    render(<VerdictCard verdict="infected" />)
    expect(screen.queryByText(/Threat:/)).not.toBeInTheDocument()
  })
})
