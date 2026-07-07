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
})
