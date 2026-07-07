/**
 * @fileoverview Unit tests for the sidebar navigation table.
 * @layer components/layout/nav-items.test
 */
import { describe, it, expect } from 'vitest'
import { NAV_GROUPS } from './nav-items'

describe('NAV_GROUPS', () => {
  it('defines the four dashboard sections in order', () => {
    expect(NAV_GROUPS.map((g) => g.group)).toEqual(['Vault', 'Transfer', 'Labs', 'System'])
  })

  it('gives every item a label, href, and a renderable icon', () => {
    for (const group of NAV_GROUPS) {
      expect(typeof group.group).toBe('string')
      expect(group.group.length).toBeGreaterThan(0)
      expect(group.items.length).toBeGreaterThan(0)
      for (const item of group.items) {
        expect(typeof item.label).toBe('string')
        expect(item.label.length).toBeGreaterThan(0)
        expect(typeof item.href).toBe('string')
        expect(item.href.startsWith('/')).toBe(true)
        // lucide icons are forwardRef objects or plain function components.
        expect(['function', 'object']).toContain(typeof item.icon)
        expect(item.icon).toBeTruthy()
      }
    }
  })

  it('exposes every dashboard route exactly once', () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href))
    expect(hrefs).toEqual([
      '/',
      '/vault',
      '/upload',
      '/direct',
      '/signed',
      '/validation',
      '/scanner',
      '/tenants',
      '/errors',
      '/system',
    ])
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})
