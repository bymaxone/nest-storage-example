/**
 * @fileoverview Unit tests for storage status display helpers.
 * @layer lib/storage-status.test
 */
import { describe, it, expect } from 'vitest'
import { healthStatusDisplay, verdictStatusDisplay, httpStatusColor } from './storage-status'

describe('healthStatusDisplay', () => {
  it('returns green classes and Healthy for status up', () => {
    const d = healthStatusDisplay('up')
    expect(d.color).toBe('text-green-400')
    expect(d.dot).toBe('bg-green-400')
    expect(d.label).toBe('Healthy')
  })

  it('returns yellow classes and Degraded for status degraded', () => {
    const d = healthStatusDisplay('degraded')
    expect(d.color).toBe('text-yellow-400')
    expect(d.dot).toBe('bg-yellow-400')
    expect(d.label).toBe('Degraded')
  })

  it('returns red classes and Unavailable for any other status', () => {
    const d = healthStatusDisplay('down')
    expect(d.color).toBe('text-red-400')
    expect(d.dot).toBe('bg-red-400')
    expect(d.label).toBe('Unavailable')
  })

  it('returns red classes for empty string status', () => {
    const d = healthStatusDisplay('')
    expect(d.color).toBe('text-red-400')
  })
})

describe('verdictStatusDisplay', () => {
  it('returns green classes and Clean for clean verdict', () => {
    const d = verdictStatusDisplay('clean')
    expect(d.color).toBe('text-green-400')
    expect(d.dot).toBe('bg-green-400')
    expect(d.label).toBe('Clean')
  })

  it('returns red classes and Infected for infected verdict', () => {
    const d = verdictStatusDisplay('infected')
    expect(d.color).toBe('text-red-400')
    expect(d.dot).toBe('bg-red-400')
    expect(d.label).toBe('Infected')
  })

  it('returns yellow classes and Unknown for any other verdict', () => {
    const d = verdictStatusDisplay('unknown')
    expect(d.color).toBe('text-yellow-400')
    expect(d.dot).toBe('bg-yellow-400')
    expect(d.label).toBe('Unknown')
  })

  it('returns yellow classes for empty string verdict', () => {
    const d = verdictStatusDisplay('')
    expect(d.color).toBe('text-yellow-400')
  })
})

describe('httpStatusColor', () => {
  it('returns text-green-400 for 200', () => {
    expect(httpStatusColor(200)).toBe('text-green-400')
  })

  it('returns text-green-400 for 201', () => {
    expect(httpStatusColor(201)).toBe('text-green-400')
  })

  it('returns text-green-400 for 299', () => {
    expect(httpStatusColor(299)).toBe('text-green-400')
  })

  it('returns text-yellow-400 for 400', () => {
    expect(httpStatusColor(400)).toBe('text-yellow-400')
  })

  it('returns text-yellow-400 for 404', () => {
    expect(httpStatusColor(404)).toBe('text-yellow-400')
  })

  it('returns text-yellow-400 for 499', () => {
    expect(httpStatusColor(499)).toBe('text-yellow-400')
  })

  it('returns text-red-400 for 500', () => {
    expect(httpStatusColor(500)).toBe('text-red-400')
  })

  it('returns text-red-400 for 300 (redirect range)', () => {
    expect(httpStatusColor(300)).toBe('text-red-400')
  })

  // Scenario: a sub-200 informational status must fall through to red, proving the
  // lower `status >= 200` bound is enforced (not collapsed to an always-true guard).
  it('returns text-red-400 for 100 (below the 2xx lower bound)', () => {
    expect(httpStatusColor(100)).toBe('text-red-400')
  })
})
