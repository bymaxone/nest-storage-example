/**
 * @fileoverview Unit tests for the Tailwind class-merge utility.
 * @layer lib/utils.test
 */
import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins plain class strings', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('applies conditional (object) class values', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active')
  })

  it('deduplicates conflicting Tailwind utilities, keeping the last', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('flattens arrays and ignores falsy values', () => {
    expect(cn(['a', false, null, undefined, 'b'])).toBe('a b')
  })
})
