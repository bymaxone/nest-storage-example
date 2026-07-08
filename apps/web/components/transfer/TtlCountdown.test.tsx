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

  /** Circumference of the r=28 progress ring. */
  const RING_CIRCUMFERENCE = 2 * Math.PI * 28

  /** Reads the numeric stroke-dashoffset of the progress ring (2nd circle). */
  function ringOffset(container: HTMLElement): number {
    const circles = container.querySelectorAll('circle')
    return Number(circles[1]?.getAttribute('stroke-dashoffset'))
  }

  it('renders the countdown ring SVG', () => {
    const expiresAt = new Date(Date.now() + 3600_000).toISOString()
    const { container } = render(<TtlCountdown expiresAt={expiresAt} ttlSeconds={3600} />)
    expect(screen.getByRole('img', { name: /expiry countdown/i })).toBeInTheDocument()
    // The wrapper is a centered vertical stack.
    expect((container.firstChild as HTMLElement).className).toContain('flex-col')
  })

  it('paints the normal state in brand colour with a proportional ring', () => {
    // Scenario: 120 s left of a 300 s TTL — not expired, not warning. Fraction is
    // 0.4 so the ring is 60% depleted, the ring and label take the brand colour,
    // and the aria label carries the live MM:SS countdown.
    const expiresAt = new Date(Date.now() + 120_000).toISOString()
    const { container } = render(<TtlCountdown expiresAt={expiresAt} ttlSeconds={300} />)
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(ringOffset(container)).toBeCloseTo(RING_CIRCUMFERENCE * 0.6, 4)
    const circles = container.querySelectorAll('circle')
    expect(circles[1]?.getAttribute('class')).toContain('stroke-brand-500')
    const label = screen.getByText('02:00')
    expect(label.className).toContain('text-brand-500')
    expect(label.className).toContain('tabular-nums')
    expect(screen.getByRole('img', { name: 'Expiry countdown: 02:00' })).toBeInTheDocument()
  })

  it('paints the warning state red with the correct ring fraction', () => {
    // Scenario: 30 s left of a 300 s TTL — warning (under 60 s), fraction 0.1.
    const expiresAt = new Date(Date.now() + 30_000).toISOString()
    const { container } = render(<TtlCountdown expiresAt={expiresAt} ttlSeconds={300} />)
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(ringOffset(container)).toBeCloseTo(RING_CIRCUMFERENCE * 0.9, 4)
    expect(container.querySelectorAll('circle')[1]?.getAttribute('class')).toContain(
      'stroke-red-400',
    )
    expect(screen.getByText('00:30').className).toContain('text-red-400')
  })

  it('treats exactly 60 s remaining as not-yet-warning', () => {
    // Scenario: at the 60 s boundary the guard is strict `< 60`, so the label is
    // still brand (not red) — proving the comparison is not `<= 60`.
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    render(<TtlCountdown expiresAt={expiresAt} ttlSeconds={300} />)
    const label = screen.getByText('01:00')
    expect(label.className).toContain('text-brand-500')
    expect(label.className).not.toContain('text-red-400')
  })

  it('shows EXPIRED when URL is already past its expiry', () => {
    // Already expired
    const expiresAt = new Date(Date.now() - 1000).toISOString()
    const { container } = render(<TtlCountdown expiresAt={expiresAt} ttlSeconds={3600} />)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    const label = screen.getByText('EXPIRED')
    expect(label).toBeInTheDocument()
    // Expired state: muted label + muted ring + "expired" in the aria label.
    expect(label.className).toContain('text-white/30')
    expect(container.querySelectorAll('circle')[1]?.getAttribute('class')).toContain(
      'stroke-white/20',
    )
    expect(screen.getByRole('img', { name: 'Expiry countdown: expired' })).toBeInTheDocument()
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

  it('renders a fully-depleted ring when ttlSeconds is not positive', () => {
    // Scenario: ttl 0 means no fraction to fill, so the ring offset equals the
    // full circumference (guards the `ttlSeconds > 0` branch against division-by-zero).
    const expiresAt = new Date(Date.now() + 300_000).toISOString()
    const { container } = render(<TtlCountdown expiresAt={expiresAt} ttlSeconds={0} />)
    expect(container.querySelectorAll('circle')).toHaveLength(2)
    expect(ringOffset(container)).toBeCloseTo(RING_CIRCUMFERENCE, 4)
  })

  it('clears its interval on unmount', () => {
    // Scenario: unmounting must run the effect cleanup so the ticking interval is
    // cleared (guards the returned cleanup function).
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const expiresAt = new Date(Date.now() + 120_000).toISOString()
    const { unmount } = render(<TtlCountdown expiresAt={expiresAt} ttlSeconds={300} />)
    unmount()
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('re-derives the countdown when the expiresAt prop changes', () => {
    // Scenario: a new expiresAt must re-run the effect (its dependency), so the
    // displayed countdown reflects the new expiry — a missing dependency would
    // keep showing the stale value from the first render.
    const first = new Date(Date.now() + 120_000).toISOString()
    const { rerender } = render(<TtlCountdown expiresAt={first} ttlSeconds={300} />)
    expect(screen.getByText('02:00')).toBeInTheDocument()
    const second = new Date(Date.now() + 30_000).toISOString()
    rerender(<TtlCountdown expiresAt={second} ttlSeconds={300} />)
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(screen.getByText('00:30')).toBeInTheDocument()
    expect(screen.queryByText('02:00')).not.toBeInTheDocument()
  })

  it('accepts an extra className on the wrapper', () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    const { container } = render(
      <TtlCountdown expiresAt={expiresAt} ttlSeconds={60} className="mt-4" />,
    )
    expect(container.firstChild).toHaveClass('mt-4')
  })
})
