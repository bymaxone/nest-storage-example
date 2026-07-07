/**
 * @fileoverview Unit and render tests for TtlCountdown.
 * @layer components/transfer/TtlCountdown.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { TtlCountdown, formatCountdown } from './TtlCountdown'

describe('formatCountdown', () => {
  it('formats sub-minute as MM:SS', () => {
    expect(formatCountdown(45)).toBe('00:45')
  })

  it('formats exactly one minute', () => {
    expect(formatCountdown(60)).toBe('01:00')
  })

  it('formats multi-minute as MM:SS', () => {
    expect(formatCountdown(125)).toBe('02:05')
  })

  it('formats one hour as HH:MM:SS', () => {
    expect(formatCountdown(3600)).toBe('01:00:00')
  })

  it('formats 2 h 30 m 15 s', () => {
    expect(formatCountdown(9015)).toBe('02:30:15')
  })

  it('clamps negative seconds to 00:00', () => {
    expect(formatCountdown(-5)).toBe('00:00')
  })

  it('clamps zero to 00:00', () => {
    expect(formatCountdown(0)).toBe('00:00')
  })
})

describe('TtlCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the countdown ring SVG', () => {
    const expiresAt = new Date(Date.now() + 3600_000).toISOString()
    render(<TtlCountdown expiresAt={expiresAt} ttlSeconds={3600} />)
    expect(screen.getByRole('img', { name: /expiry countdown/i })).toBeInTheDocument()
  })

  it('shows EXPIRED when URL is already past its expiry', () => {
    // Already expired
    const expiresAt = new Date(Date.now() - 1000).toISOString()
    render(<TtlCountdown expiresAt={expiresAt} ttlSeconds={3600} />)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(screen.getByText('EXPIRED')).toBeInTheDocument()
  })

  it('shows countdown text when URL is still valid', () => {
    const expiresAt = new Date(Date.now() + 120_000).toISOString()
    render(<TtlCountdown expiresAt={expiresAt} ttlSeconds={120} />)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    // Should show something like 01:59 or 02:00
    expect(screen.queryByText('EXPIRED')).not.toBeInTheDocument()
  })

  it('transitions to EXPIRED after the TTL elapses', () => {
    const expiresAt = new Date(Date.now() + 2000).toISOString()
    render(<TtlCountdown expiresAt={expiresAt} ttlSeconds={2} />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText('EXPIRED')).toBeInTheDocument()
  })

  it('applies the warning styling under 60 seconds remaining', () => {
    const expiresAt = new Date(Date.now() + 30_000).toISOString()
    render(<TtlCountdown expiresAt={expiresAt} ttlSeconds={300} />)
    // Warning label turns red while still counting down.
    expect(screen.getByText('00:30')).toHaveClass('text-red-400')
  })

  it('renders an empty ring when ttlSeconds is not positive', () => {
    const expiresAt = new Date(Date.now() + 300_000).toISOString()
    const { container } = render(<TtlCountdown expiresAt={expiresAt} ttlSeconds={0} />)
    expect(container.querySelectorAll('circle')).toHaveLength(2)
  })

  it('accepts an extra className on the wrapper', () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    const { container } = render(
      <TtlCountdown expiresAt={expiresAt} ttlSeconds={60} className="mt-4" />,
    )
    expect(container.firstChild).toHaveClass('mt-4')
  })
})
