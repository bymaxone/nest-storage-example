/**
 * @fileoverview Unit tests for the shared formatting helpers.
 * @layer lib/format.test
 */
import { describe, it, expect } from 'vitest'
import { formatBytes, formatDate } from './format'

describe('formatBytes', () => {
  it('renders raw bytes below 1 KiB with the B unit', () => {
    // Scenario: sub-kilobyte sizes.
    // Rule it protects: values under 1024 render as plain bytes, no decimals.
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('renders KiB with one decimal between 1 KiB and 1 MiB', () => {
    // Scenario: kilobyte-scale sizes.
    // Rule it protects: the KB branch divides by 1024 and keeps one decimal.
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('renders MiB with one decimal between 1 MiB and 1 GiB', () => {
    // Scenario: megabyte-scale sizes.
    // Rule it protects: the MB branch divides by 1024^2 and keeps one decimal.
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('renders GiB with one decimal at or above 1 GiB', () => {
    // Scenario: gigabyte-scale sizes.
    // Rule it protects: the final GB branch handles the largest magnitude.
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB')
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.0 GB')
  })
})

describe('formatDate', () => {
  it('formats a Date instance via toLocaleString', () => {
    // Scenario: a Date object from an API response.
    // Rule it protects: the helper delegates to the platform locale formatter.
    const d = new Date('2026-07-07T12:00:00.000Z')
    expect(formatDate(d)).toBe(d.toLocaleString())
  })

  it('formats an ISO string by constructing a Date first', () => {
    // Scenario: a raw ISO date string.
    // Rule it protects: string inputs are coerced through the Date constructor.
    const iso = '2026-07-07T12:00:00.000Z'
    expect(formatDate(iso)).toBe(new Date(iso).toLocaleString())
  })
})
