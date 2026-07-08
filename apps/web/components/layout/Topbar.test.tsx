/**
 * @fileoverview Unit tests for the dashboard top bar and its health chip.
 * @layer components/layout/Topbar.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Topbar } from './Topbar'

function renderTopbar(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, retryDelay: 0 } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function healthResponse(body: unknown, ok = true): Response {
  // Mirror the fields the api-client reads: ok, status, headers.get, and json().
  return {
    ok,
    status: ok ? 200 : 503,
    headers: { get: () => null },
    json: () => Promise.resolve(body),
  } as unknown as Response
}

describe('Topbar', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('renders the brand wordmark', () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      healthResponse({ status: 'up', latencyMs: 12, bucket: 'vault' }),
    )
    renderTopbar(<Topbar />)
    expect(screen.getByText('nest-storage-example')).toBeInTheDocument()
  })

  it('shows the checking state before the health query resolves', () => {
    vi.mocked(globalThis.fetch).mockReturnValue(new Promise(() => {}))
    renderTopbar(<Topbar />)
    const chip = screen.getByText('checking…').parentElement
    expect(chip).toBeInTheDocument()
    // The loading chip uses the muted colour.
    expect(chip?.className).toContain('text-white/40')
  })

  it('shows online latency once the health query succeeds', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      healthResponse({ status: 'up', latencyMs: 42, bucket: 'vault' }),
    )
    renderTopbar(<Topbar />)
    await waitFor(() => expect(screen.getByText('online · 42 ms')).toBeInTheDocument())
    // A healthy poll paints the chip green.
    expect(screen.getByText('online · 42 ms').parentElement?.className).toContain('text-green-400')
  })

  it('falls back to 0 ms when the response omits latency', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(healthResponse({ status: 'up', bucket: 'vault' }))
    renderTopbar(<Topbar />)
    await waitFor(() => expect(screen.getByText('online · 0 ms')).toBeInTheDocument())
  })

  it('shows offline when the health query errors', async () => {
    // Both the initial attempt and the single retry fail immediately (retryDelay: 0).
    vi.mocked(globalThis.fetch).mockResolvedValue(healthResponse(null, false))
    renderTopbar(<Topbar />)
    // Advance micro/macro task queue to let both fetch attempts and the state
    // update settle before the assertion — 500ms is more than enough.
    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 500))
    })
    const chip = screen.getByText('offline').parentElement
    expect(chip).toBeInTheDocument()
    // A failed poll paints the chip red.
    expect(chip?.className).toContain('text-red-400')
  })

  it('renders the right slot when provided', () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      healthResponse({ status: 'up', latencyMs: 1, bucket: 'vault' }),
    )
    renderTopbar(<Topbar right={<span>slot-content</span>} />)
    expect(screen.getByText('slot-content')).toBeInTheDocument()
  })

  it('omits the right slot when not provided', () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      healthResponse({ status: 'up', latencyMs: 1, bucket: 'vault' }),
    )
    renderTopbar(<Topbar />)
    expect(screen.queryByText('slot-content')).not.toBeInTheDocument()
  })

  it('invokes onMenuOpen when the hamburger is pressed', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      healthResponse({ status: 'up', latencyMs: 1, bucket: 'vault' }),
    )
    const onMenuOpen = vi.fn()
    renderTopbar(<Topbar onMenuOpen={onMenuOpen} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    expect(onMenuOpen).toHaveBeenCalledTimes(1)
  })

  it('does not throw when the hamburger is pressed without a handler', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      healthResponse({ status: 'up', latencyMs: 1, bucket: 'vault' }),
    )
    renderTopbar(<Topbar />)
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    expect(screen.getByText('nest-storage-example')).toBeInTheDocument()
  })
})
