/**
 * @fileoverview Render tests for EnvelopePanel.
 * @layer components/labs/EnvelopePanel.test
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EnvelopePanel } from './EnvelopePanel'

describe('EnvelopePanel', () => {
  it('renders the HTTP status, code, and message', () => {
    render(
      <EnvelopePanel
        envelope={{
          httpStatus: 422,
          code: 'STORAGE_MIME_NOT_ALLOWED',
          message: 'MIME type not allowed',
        }}
      />,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('422')).toBeInTheDocument()
    expect(screen.getByText('STORAGE_MIME_NOT_ALLOWED')).toBeInTheDocument()
    expect(screen.getByText('MIME type not allowed')).toBeInTheDocument()
  })

  it('renders known storage error code with brand styling', () => {
    render(
      <EnvelopePanel
        envelope={{
          httpStatus: 422,
          code: 'STORAGE_SIZE_EXCEEDED',
          message: 'File too large',
        }}
      />,
    )
    const codeEl = screen.getByText('STORAGE_SIZE_EXCEEDED')
    expect(codeEl).toBeInTheDocument()
  })

  it('renders unknown error code in muted style', () => {
    render(
      <EnvelopePanel
        envelope={{
          httpStatus: 500,
          code: 'UNKNOWN',
          message: 'Internal server error',
        }}
      />,
    )
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument()
  })

  it('renders details section when details present', () => {
    render(
      <EnvelopePanel
        envelope={{
          httpStatus: 422,
          code: 'STORAGE_VALIDATION_FAILED',
          message: 'Validation failed',
          details: { field: 'file', reason: 'magic bytes mismatch' },
        }}
      />,
    )
    expect(screen.getByText('Details ▸')).toBeInTheDocument()
    const pre = screen.getByRole('alert').querySelector('pre')
    expect(pre?.textContent).toContain('magic bytes mismatch')
  })

  it('does not render details section when details are absent', () => {
    render(
      <EnvelopePanel
        envelope={{
          httpStatus: 404,
          code: 'STORAGE_OBJECT_NOT_FOUND',
          message: 'Not found',
        }}
      />,
    )
    expect(screen.queryByText('Details ▸')).not.toBeInTheDocument()
  })

  it('does not render details section when details is empty object', () => {
    render(
      <EnvelopePanel
        envelope={{
          httpStatus: 404,
          code: 'STORAGE_OBJECT_NOT_FOUND',
          message: 'Not found',
          details: {},
        }}
      />,
    )
    expect(screen.queryByText('Details ▸')).not.toBeInTheDocument()
  })
})
