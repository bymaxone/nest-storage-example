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
    const { container } = render(<UploadDropzone onFile={vi.fn()} />)
    const dropzone = screen.getByRole('button', { name: /upload dropzone/i })
    expect(dropzone).toBeInTheDocument()
    expect(screen.getByText(/drop a file or click to browse/i)).toBeInTheDocument()
    // Wrapper + dropzone keep their layout classes; idle uses the inactive border.
    expect((container.firstChild as HTMLElement).className).toContain('flex-col')
    expect(dropzone.className).toContain('border-dashed')
    expect(dropzone.className).toContain('border-(--glass-border)')
    // No drag highlight and no strategy badge without a strategy prop.
    expect(dropzone).not.toHaveClass('border-brand-500')
    expect(screen.queryByText('Single-shot')).not.toBeInTheDocument()
    expect(screen.queryByText('Multipart')).not.toBeInTheDocument()
  })

  it('shows uploading state when isPending is true', () => {
    render(<UploadDropzone onFile={vi.fn()} isPending />)
    expect(screen.getByText(/uploading/i)).toBeInTheDocument()
  })

  it('shows the multipart badge with the solid brand variant', () => {
    render(<UploadDropzone onFile={vi.fn()} strategy="multipart" />)
    const badge = screen.getByText('Multipart')
    expect(badge).toBeInTheDocument()
    // Multipart maps to the default (solid brand) badge variant.
    expect(badge.className).toContain('bg-brand-500')
  })

  it('shows the single-shot badge with the outline variant', () => {
    render(<UploadDropzone onFile={vi.fn()} strategy="single" />)
    const badge = screen.getByText('Single-shot')
    expect(badge).toBeInTheDocument()
    // Single maps to the outline badge variant (no solid brand fill).
    expect(badge.className).toContain('text-foreground')
    expect(badge.className).not.toContain('bg-brand-500')
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
    // The percentage label and the fill width both reflect 50%.
    expect(screen.getByText('50%')).toBeInTheDocument()
    const fill = progressbar.querySelector('div') as HTMLElement
    expect(fill.style.width).toBe('50%')
  })

  it('hides the percentage label when a strategy is set but no progress exists', () => {
    // Scenario: with a strategy chip but no progress, no percentage should render
    // (guards the `progressPercent !== undefined` conditional).
    render(<UploadDropzone onFile={vi.fn()} strategy="single" />)
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
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

  it('does not open the dialog for keys other than Enter or Space', () => {
    // Scenario: an arbitrary key must NOT open the picker (guards both key checks).
    render(<UploadDropzone onFile={vi.fn()} />)
    const dropzone = screen.getByRole('button', { name: /upload dropzone/i })
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    fireEvent.keyDown(dropzone, { key: 'a' })
    expect(click).not.toHaveBeenCalled()
    click.mockRestore()
  })

  it('resets the dragging highlight after a drop', () => {
    // Scenario: dropping a file clears the drag highlight (guards setIsDragging(false)).
    render(<UploadDropzone onFile={vi.fn()} />)
    const dropzone = screen.getByRole('button', { name: /upload dropzone/i })
    fireEvent.dragOver(dropzone)
    expect(dropzone).toHaveClass('border-brand-500')
    fireEvent.drop(dropzone, { dataTransfer: { files: [makeFile()] } })
    expect(dropzone).not.toHaveClass('border-brand-500')
  })

  it('ignores a change event whose files list is null', () => {
    // Scenario: some browsers deliver a null files list; the optional-chaining
    // access must tolerate it without throwing (guards e.target.files?.[0]).
    const onFile = vi.fn()
    const { container } = render(<UploadDropzone onFile={onFile} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: null } })
    expect(onFile).not.toHaveBeenCalled()
  })

  it('uses the latest onFile handler when the prop changes (input)', () => {
    // Scenario: the change callback must track the current onFile prop, not a
    // stale closure from the first render (guards the [onFile] dependency).
    const first = vi.fn()
    const second = vi.fn()
    const { container, rerender } = render(<UploadDropzone onFile={first} />)
    rerender(<UploadDropzone onFile={second} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('uses the latest onFile handler when the prop changes (drop)', () => {
    // Scenario: the drop callback must also track the current onFile prop.
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<UploadDropzone onFile={first} />)
    rerender(<UploadDropzone onFile={second} />)
    const dropzone = screen.getByRole('button', { name: /upload dropzone/i })
    fireEvent.drop(dropzone, { dataTransfer: { files: [makeFile()] } })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
