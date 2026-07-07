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
    expect(screen.getByText('Engine: MarkerFileScanner')).toBeInTheDocument()
  })

  it('does not render threat section when threat is absent', () => {
    render(<VerdictCard verdict="infected" />)
    expect(screen.queryByText(/Threat:/)).not.toBeInTheDocument()
  })
})
