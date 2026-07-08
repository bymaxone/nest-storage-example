/**
 * @fileoverview Unit tests for the sidebar nav rail and active-route logic.
 * @layer components/layout/Sidebar.test
 */
import type { ReactNode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from './Sidebar'

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
    children: ReactNode
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { usePathname } from 'next/navigation'

describe('Sidebar', () => {
  it('renders a link for every nav route', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar isOpen={false} />)
    expect(screen.getAllByRole('link')).toHaveLength(10)
  })

  it('marks / active only on the exact root path', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: /overview/i })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark / active on a non-root path', () => {
    vi.mocked(usePathname).mockReturnValue('/vault')
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: /overview/i })).not.toHaveAttribute('aria-current')
  })

  it('marks a route active on an exact non-root match', () => {
    vi.mocked(usePathname).mockReturnValue('/vault')
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: /browser/i })).toHaveAttribute('aria-current', 'page')
  })

  it('marks a route active on a nested child path (prefix match)', () => {
    vi.mocked(usePathname).mockReturnValue('/vault/images/photo.png')
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: /browser/i })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark overview active on a doubled-slash path', () => {
    // Scenario: root matches ONLY the exact '/'. A '//' path must not activate
    // overview, proving the root guard compares against '/' (not a prefix match).
    vi.mocked(usePathname).mockReturnValue('//')
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: /overview/i })).not.toHaveAttribute('aria-current')
  })

  it('does not mark an unrelated route active on a non-matching path', () => {
    // Scenario: at /vault, a sibling route like /upload must stay inactive,
    // proving the non-root match is an exact/prefix test (not always true).
    vi.mocked(usePathname).mockReturnValue('/vault')
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('link', { name: /upload lab/i })).not.toHaveAttribute('aria-current')
  })

  it('renders the nav landmark when closed', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('hides the rail off-canvas when closed and shows it when open', () => {
    // Scenario: the open flag toggles the flex/hidden visibility classes on the
    // nav element (guards the isOpen ? 'flex' : 'hidden lg:flex' branch).
    vi.mocked(usePathname).mockReturnValue('/')
    const { rerender } = render(<Sidebar isOpen={false} />)
    expect(screen.getByRole('navigation').classList.contains('hidden')).toBe(true)
    rerender(<Sidebar isOpen />)
    const nav = screen.getByRole('navigation')
    expect(nav.classList.contains('flex')).toBe(true)
    expect(nav.classList.contains('hidden')).toBe(false)
  })

  it('calls onNavClick when a nav item is clicked and the rail is open', async () => {
    const onNavClick = vi.fn()
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar isOpen onNavClick={onNavClick} />)
    await userEvent.click(screen.getAllByRole('link')[0]!)
    expect(onNavClick).toHaveBeenCalledTimes(1)
  })

  it('does not throw when a nav item is clicked without an onNavClick handler', async () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar isOpen={false} />)
    await userEvent.click(screen.getAllByRole('link')[0]!)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
