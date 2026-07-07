/**
 * @fileoverview Render tests for AppShell.
 * @layer components/layout/AppShell.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from './AppShell'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

beforeEach(() => {
  // Stub fetch so the Topbar health query doesn't make real network calls
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function wrapper(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

describe('AppShell', () => {
  it('renders children inside the main content area', () => {
    render(
      wrapper(
        <AppShell>
          <p>Page content</p>
        </AppShell>,
      ),
    )
    expect(screen.getByText('Page content')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('applies max-w-5xl when wide is not set', () => {
    render(
      wrapper(
        <AppShell>
          <span>Default</span>
        </AppShell>,
      ),
    )
    const main = screen.getByRole('main')
    const contentWell = main.firstChild as HTMLElement
    expect(contentWell?.className).toContain('max-w-5xl')
  })

  it('applies max-w-7xl when wide is set', () => {
    render(
      wrapper(
        <AppShell wide>
          <span>Wide</span>
        </AppShell>,
      ),
    )
    const main = screen.getByRole('main')
    const contentWell = main.firstChild as HTMLElement
    expect(contentWell?.className).toContain('max-w-7xl')
  })

  it('renders mobile overlay button when sidebar is open', async () => {
    render(
      wrapper(
        <AppShell>
          <span>Content</span>
        </AppShell>,
      ),
    )
    // Click the hamburger button to open the sidebar
    const hamburger = screen.getByRole('button', { name: /open navigation menu/i })
    await userEvent.click(hamburger)
    expect(screen.getByRole('button', { name: /close navigation menu/i })).toBeInTheDocument()
  })

  it('closes mobile sidebar when overlay is clicked', async () => {
    render(
      wrapper(
        <AppShell>
          <span>Content</span>
        </AppShell>,
      ),
    )
    const hamburger = screen.getByRole('button', { name: /open navigation menu/i })
    await userEvent.click(hamburger)
    const closeButton = screen.getByRole('button', { name: /close navigation menu/i })
    await userEvent.click(closeButton)
    expect(screen.queryByRole('button', { name: /close navigation menu/i })).not.toBeInTheDocument()
  })

  it('closes the mobile sidebar after a nav link is clicked', async () => {
    render(
      wrapper(
        <AppShell>
          <span>Content</span>
        </AppShell>,
      ),
    )
    await userEvent.click(screen.getByRole('button', { name: /open navigation menu/i }))
    expect(screen.getByRole('button', { name: /close navigation menu/i })).toBeInTheDocument()
    // Clicking a sidebar link fires AppShell's onNavClick, collapsing the overlay.
    await userEvent.click(screen.getAllByRole('link')[0]!)
    expect(screen.queryByRole('button', { name: /close navigation menu/i })).not.toBeInTheDocument()
  })
})
