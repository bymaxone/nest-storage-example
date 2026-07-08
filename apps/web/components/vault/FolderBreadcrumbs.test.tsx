/**
 * @fileoverview Unit and render tests for FolderBreadcrumbs.
 * @layer components/vault/FolderBreadcrumbs.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FolderBreadcrumbs, parsePrefixToCrumbs } from './FolderBreadcrumbs'

describe('parsePrefixToCrumbs', () => {
  it('returns only root for empty prefix', () => {
    const crumbs = parsePrefixToCrumbs('')
    expect(crumbs).toHaveLength(1)
    expect(crumbs[0]).toEqual({ label: 'root', prefix: '' })
  })

  it('parses a single-segment prefix', () => {
    const crumbs = parsePrefixToCrumbs('images/')
    expect(crumbs).toHaveLength(2)
    expect(crumbs[1]).toEqual({ label: 'images', prefix: 'images/' })
  })

  it('parses a multi-segment prefix', () => {
    const crumbs = parsePrefixToCrumbs('docs/2024/q1/')
    expect(crumbs).toHaveLength(4)
    expect(crumbs[1]).toEqual({ label: 'docs', prefix: 'docs/' })
    expect(crumbs[2]).toEqual({ label: '2024', prefix: 'docs/2024/' })
    expect(crumbs[3]).toEqual({ label: 'q1', prefix: 'docs/2024/q1/' })
  })

  it('ignores trailing empty parts', () => {
    const crumbs = parsePrefixToCrumbs('foo/')
    expect(crumbs.map((c) => c.label)).toEqual(['root', 'foo'])
  })
})

describe('FolderBreadcrumbs', () => {
  it('renders only home button for empty prefix', () => {
    const onNavigate = vi.fn()
    render(<FolderBreadcrumbs prefix="" onNavigate={onNavigate} />)
    const nav = screen.getByRole('navigation', { name: 'Folder path' })
    expect(nav).toBeInTheDocument()
    // Only the root home button
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
  })

  it('renders segment buttons for a deep prefix', () => {
    const onNavigate = vi.fn()
    render(<FolderBreadcrumbs prefix="docs/2024/" onNavigate={onNavigate} />)
    expect(screen.getByText('docs')).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
  })

  it('calls onNavigate with empty string when root is clicked', async () => {
    const onNavigate = vi.fn()
    render(<FolderBreadcrumbs prefix="docs/" onNavigate={onNavigate} />)
    const homeButton = screen.getAllByRole('button')[0]
    await userEvent.click(homeButton!)
    expect(onNavigate).toHaveBeenCalledWith('')
  })

  it('calls onNavigate with segment prefix when segment is clicked', async () => {
    const onNavigate = vi.fn()
    render(<FolderBreadcrumbs prefix="docs/2024/" onNavigate={onNavigate} />)
    const docsButton = screen.getByText('docs')
    await userEvent.click(docsButton)
    expect(onNavigate).toHaveBeenCalledWith('docs/')
  })

  it('renders the nav landmark with its layout classes', () => {
    // Scenario: the nav wrapper keeps its monospace layout classes.
    render(<FolderBreadcrumbs prefix="" onNavigate={vi.fn()} />)
    const nav = screen.getByRole('navigation', { name: 'Folder path' })
    expect(nav.className).toContain('font-mono')
    expect(nav.className).toContain('items-center')
  })

  it('renders the root as a home icon button, never as literal "root" text', () => {
    // Scenario: the root crumb renders the Home icon branch, so the string
    // 'root' must never appear as a visible label (guards the label === 'root' check).
    render(<FolderBreadcrumbs prefix="docs/" onNavigate={vi.fn()} />)
    expect(screen.queryByText('root')).not.toBeInTheDocument()
    const home = screen.getAllByRole('button')[0]!
    expect(home.querySelector('svg.lucide-house, svg.lucide-home')).not.toBeNull()
    expect(home.className).toContain('items-center')
  })

  it('places a chevron separator before every crumb except the first', () => {
    // Scenario: three crumbs (root/docs/2024) yield exactly two chevrons, one
    // before each non-first crumb (guards the i > 0 separator condition).
    const { container } = render(<FolderBreadcrumbs prefix="docs/2024/" onNavigate={vi.fn()} />)
    expect(container.querySelectorAll('svg.lucide-chevron-right')).toHaveLength(2)
  })

  it('marks only the last crumb as the current page', () => {
    // Scenario: for docs/2024/, the trailing '2024' crumb is current and styled
    // bold-brand; the earlier 'docs' crumb and the root are not current.
    render(<FolderBreadcrumbs prefix="docs/2024/" onNavigate={vi.fn()} />)
    const last = screen.getByText('2024')
    expect(last).toHaveAttribute('aria-current', 'page')
    expect(last.className).toContain('text-brand-500')
    expect(last.className).toContain('font-semibold')
    expect(last.className).toContain('transition-colors')

    const middle = screen.getByText('docs')
    expect(middle).not.toHaveAttribute('aria-current')
    expect(middle.className).toContain('text-white/50')

    const home = screen.getAllByRole('button')[0]!
    expect(home).not.toHaveAttribute('aria-current')
    expect(home.className).toContain('text-white/50')
  })

  it('marks the root as current and brand-coloured when it is the only crumb', () => {
    // Scenario: at the root prefix the sole home button is the last crumb, so it
    // is the current page and takes the active brand colour.
    render(<FolderBreadcrumbs prefix="" onNavigate={vi.fn()} />)
    const home = screen.getAllByRole('button')[0]!
    expect(home).toHaveAttribute('aria-current', 'page')
    expect(home.className).toContain('text-brand-500')
  })
})
