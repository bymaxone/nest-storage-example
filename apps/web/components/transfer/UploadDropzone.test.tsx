/**
 * @fileoverview Unit and render tests for UploadDropzone.
 * @layer components/transfer/UploadDropzone.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UploadDropzone, strategyFromMultipart } from './UploadDropzone'

/** Builds a plain File for input/drop simulation. */
function makeFile(name = 'a.txt'): File {
  return new File(['data'], name, { type: 'text/plain' })
}

describe('strategyFromMultipart', () => {
  it('returns multipart when true', () => {
    expect(strategyFromMultipart(true)).toBe('multipart')
  })

  it('returns single when false', () => {
    expect(strategyFromMultipart(false)).toBe('single')
  })
})

describe('UploadDropzone', () => {
  it('renders idle state with upload icon', () => {
    render(<UploadDropzone onFile={vi.fn()} />)
    expect(screen.getByRole('button', { name: /upload dropzone/i })).toBeInTheDocument()
    expect(screen.getByText(/drop a file or click to browse/i)).toBeInTheDocument()
  })

  it('shows uploading state when isPending is true', () => {
    render(<UploadDropzone onFile={vi.fn()} isPending />)
    expect(screen.getByText(/uploading/i)).toBeInTheDocument()
  })

  it('shows strategy badge when strategy is set', () => {
    render(<UploadDropzone onFile={vi.fn()} strategy="multipart" />)
    expect(screen.getByText('Multipart')).toBeInTheDocument()
  })

  it('shows single-shot badge for single strategy', () => {
    render(<UploadDropzone onFile={vi.fn()} strategy="single" />)
    expect(screen.getByText('Single-shot')).toBeInTheDocument()
  })

  it('does not render strategy badge when strategy is idle', () => {
    render(<UploadDropzone onFile={vi.fn()} strategy="idle" />)
    expect(screen.queryByText('Multipart')).not.toBeInTheDocument()
    expect(screen.queryByText('Single-shot')).not.toBeInTheDocument()
  })

  it('renders progress bar when progress is provided', () => {
    render(
      <UploadDropzone onFile={vi.fn()} strategy="single" progress={{ loaded: 500, total: 1000 }} />,
    )
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '50')
  })

  it('shows the uploading (File) icon and disables interaction when pending', () => {
    const { container } = render(<UploadDropzone onFile={vi.fn()} isPending />)
    const dropzone = screen.getByRole('button', { name: /upload dropzone/i })
    expect(dropzone).toHaveClass('pointer-events-none')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders no percentage label when progress total is zero', () => {
    render(<UploadDropzone onFile={vi.fn()} strategy="single" progress={{ loaded: 0, total: 0 }} />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('fires onFile when a file is chosen through the input', () => {
    const onFile = vi.fn()
    const { container } = render(<UploadDropzone onFile={onFile} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })
    expect(onFile).toHaveBeenCalledTimes(1)
  })

  it('ignores a change event with no file', () => {
    const onFile = vi.fn()
    const { container } = render(<UploadDropzone onFile={onFile} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [] } })
    expect(onFile).not.toHaveBeenCalled()
  })

  it('fires onFile when a file is dropped', () => {
    const onFile = vi.fn()
    render(<UploadDropzone onFile={onFile} />)
    const dropzone = screen.getByRole('button', { name: /upload dropzone/i })
    fireEvent.drop(dropzone, { dataTransfer: { files: [makeFile()] } })
    expect(onFile).toHaveBeenCalledTimes(1)
  })

  it('ignores a drop with no file', () => {
    const onFile = vi.fn()
    render(<UploadDropzone onFile={onFile} />)
    const dropzone = screen.getByRole('button', { name: /upload dropzone/i })
    fireEvent.drop(dropzone, { dataTransfer: { files: [] } })
    expect(onFile).not.toHaveBeenCalled()
  })

  it('toggles the dragging state on dragOver and dragLeave', () => {
    render(<UploadDropzone onFile={vi.fn()} />)
    const dropzone = screen.getByRole('button', { name: /upload dropzone/i })
    fireEvent.dragOver(dropzone)
    expect(dropzone).toHaveClass('border-brand-500')
    fireEvent.dragLeave(dropzone)
    expect(dropzone).not.toHaveClass('border-brand-500')
  })

  it('opens the file dialog on Enter and Space, ignoring other keys', () => {
    render(<UploadDropzone onFile={vi.fn()} />)
    const dropzone = screen.getByRole('button', { name: /upload dropzone/i })
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    fireEvent.keyDown(dropzone, { key: 'Enter' })
    fireEvent.keyDown(dropzone, { key: ' ' })
    fireEvent.keyDown(dropzone, { key: 'a' })
    expect(click).toHaveBeenCalledTimes(2)
    click.mockRestore()
  })

  it('opens the file dialog when the dropzone is clicked', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    render(<UploadDropzone onFile={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /upload dropzone/i }))
    expect(click).toHaveBeenCalled()
    click.mockRestore()
  })
})
