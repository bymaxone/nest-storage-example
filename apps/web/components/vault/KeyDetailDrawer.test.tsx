/**
 * @fileoverview Render tests for the vault object detail drawer, covering the
 * metadata, preview, hex-range, and URL tabs plus the signed-URL flow.
 * @layer components/vault/KeyDetailDrawer.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { ObjectMetadata } from '@bymax-one/nest-storage/shared'

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]): void => {
      toastSuccess(...a)
    },
    error: (...a: unknown[]): void => {
      toastError(...a)
    },
  },
}))

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
vi.mock('@/lib/api-client', () => ({
  apiGet: (path: string): Promise<unknown> => apiGetMock(path) as Promise<unknown>,
  apiPost: (path: string, body: unknown): Promise<unknown> =>
    apiPostMock(path, body) as Promise<unknown>,
}))

import { KeyDetailDrawer } from './KeyDetailDrawer'

/** 'ABCD' encoded as base64, used for the preview and range panels. */
const SAMPLE_B64 = 'QUJDRA=='

/** Builds a full ObjectMetadata with optional fields toggled. */
function makeMeta(overrides: Partial<ObjectMetadata> = {}): ObjectMetadata {
  return {
    key: 'docs/report.pdf',
    bucket: 'vault',
    size: 2048,
    contentType: 'application/pdf',
    etag: '"etag-123"',
    lastModified: new Date('2026-07-07T10:00:00.000Z'),
    metadata: {},
    ...overrides,
  }
}

/** Routes apiGet by path to the supplied fixtures. */
function routeApiGet(
  meta: ObjectMetadata,
  publicUrl = 'http://localhost:9000/vault/docs/report.pdf',
): void {
  apiGetMock.mockImplementation((path: string) => {
    if (path.startsWith('/vault/object/preview'))
      return Promise.resolve({ base64: SAMPLE_B64, metadata: meta })
    if (path.startsWith('/vault/object/range'))
      return Promise.resolve({ base64: SAMPLE_B64, metadata: meta })
    if (path.startsWith('/vault/object/public-url')) return Promise.resolve({ publicUrl })
    return Promise.resolve(meta)
  })
}

function renderDrawer(onClose = vi.fn()) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return {
    onClose,
    ...render(<KeyDetailDrawer objectKey="docs/report.pdf" onClose={onClose} />, { wrapper }),
  }
}

beforeEach(() => {
  apiGetMock.mockReset()
  apiPostMock.mockReset()
  toastSuccess.mockReset()
  toastError.mockReset()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('KeyDetailDrawer — metadata tab', () => {
  it('renders the drawer shell and object key', () => {
    apiGetMock.mockReturnValue(new Promise<never>(() => {}))
    renderDrawer()
    expect(screen.getByRole('dialog', { name: 'Object details' })).toBeInTheDocument()
    expect(screen.getByText('docs/report.pdf')).toBeInTheDocument()
  })

  it('renders all optional metadata fields and custom metadata', async () => {
    routeApiGet(
      makeMeta({
        cacheControl: 'public, max-age=31536000',
        contentDisposition: 'inline',
        storageClass: 'STANDARD',
        versionId: 'v-42',
        metadata: { author: 'ada' },
      }),
    )
    renderDrawer()
    expect(await screen.findByText('Cache-Control')).toBeInTheDocument()
    expect(screen.getByText('Content-Disposition')).toBeInTheDocument()
    expect(screen.getByText('Storage Class')).toBeInTheDocument()
    expect(screen.getByText('Version ID')).toBeInTheDocument()
    expect(screen.getByText('Custom Metadata')).toBeInTheDocument()
    expect(screen.getByText('author')).toBeInTheDocument()
  })

  it('renders every base metadata row label', async () => {
    // Scenario: the fixed metadata rows each carry their exact label (guards the
    // [label, value] row tuples and their label string literals).
    routeApiGet(makeMeta())
    renderDrawer()
    for (const label of ['Key', 'Bucket', 'Size', 'Content-Type', 'ETag', 'Last Modified']) {
      expect(await screen.findByText(label)).toBeInTheDocument()
    }
  })

  it('omits optional fields when absent', async () => {
    routeApiGet(makeMeta())
    const { container } = renderDrawer()
    await screen.findByText('Bucket')
    expect(screen.queryByText('Cache-Control')).not.toBeInTheDocument()
    expect(screen.queryByText('Custom Metadata')).not.toBeInTheDocument()
    // Only the six base rows exist — no stray rows leak from the optional-field
    // spreads (guards the `: []` else branches against non-empty replacements).
    const rows = container.querySelector('dl')?.querySelectorAll(':scope > div')
    expect(rows).toHaveLength(6)
  })

  it('reads all four object queries from their exact keys without refetching', async () => {
    // Scenario: with every query key pre-seeded and data kept fresh, the drawer
    // must render from cache and never call the API — a wrong queryKey would miss
    // the cache and trigger a fetch.
    const meta = makeMeta({ contentType: 'image/png' })
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    })
    qc.setQueryData(['vault', 'meta', 'docs/report.pdf'], meta)
    qc.setQueryData(['vault', 'preview', 'docs/report.pdf'], { base64: SAMPLE_B64, metadata: meta })
    qc.setQueryData(['vault', 'range', 'docs/report.pdf'], { base64: SAMPLE_B64, metadata: meta })
    qc.setQueryData(['vault', 'public-url', 'docs/report.pdf'], {
      publicUrl: 'http://localhost:9000/vault/docs/report.pdf',
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    render(<KeyDetailDrawer objectKey="docs/report.pdf" onClose={vi.fn()} />, { wrapper })
    await screen.findByText('Bucket')
    expect(apiGetMock).not.toHaveBeenCalled()
  })

  it('invokes onClose when the close button is pressed', async () => {
    routeApiGet(makeMeta())
    const { onClose } = renderDrawer()
    await userEvent.click(screen.getByRole('button', { name: /close drawer/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('formats a sub-kilobyte size in bytes', async () => {
    routeApiGet(makeMeta({ size: 512 }))
    renderDrawer()
    expect(await screen.findByText('512 B')).toBeInTheDocument()
  })

  it('formats a multi-megabyte size in megabytes', async () => {
    routeApiGet(makeMeta({ size: 3 * 1024 * 1024 }))
    renderDrawer()
    expect(await screen.findByText('3.0 MB')).toBeInTheDocument()
  })

  it('renders all four tabs', () => {
    routeApiGet(makeMeta())
    renderDrawer()
    expect(screen.getByRole('tab', { name: /metadata/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /preview/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /hex range/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /urls/i })).toBeInTheDocument()
  })
})

describe('KeyDetailDrawer — preview tab', () => {
  it('renders the image when the object is an image', async () => {
    routeApiGet(makeMeta({ contentType: 'image/png' }))
    renderDrawer()
    await userEvent.click(screen.getByRole('tab', { name: 'Preview' }))
    const img = await screen.findByRole('img', { name: /preview of/i })
    expect(img).toHaveAttribute('src', expect.stringContaining('data:image/png;base64,'))
  })

  it('disables the Preview trigger for non-image objects', async () => {
    routeApiGet(makeMeta({ contentType: 'application/pdf' }))
    renderDrawer()
    await screen.findByText('Bucket')
    // Radix disables (and unmounts) the Preview panel unless the object is an image.
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeDisabled()
  })
})

describe('KeyDetailDrawer — hex tab', () => {
  it('renders the hex dump for the byte range', async () => {
    routeApiGet(makeMeta())
    renderDrawer()
    await userEvent.click(screen.getByRole('tab', { name: 'Hex Range' }))
    expect(await screen.findByRole('table', { name: /hex dump/i })).toBeInTheDocument()
    expect(screen.getByText(/first 1 KiB/i)).toBeInTheDocument()
  })
})

describe('KeyDetailDrawer — URLs tab', () => {
  it('copies the public URL to the clipboard', async () => {
    routeApiGet(makeMeta())
    renderDrawer()
    await userEvent.click(screen.getByRole('tab', { name: 'URLs' }))
    await screen.findByText('Public URL')
    await userEvent.click(screen.getByRole('button', { name: /copy public url/i }))
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Public URL copied'))
  })

  it('renders the open-in-new-tab anchor for an http(s) public URL', async () => {
    // Scenario: a well-formed https/http public URL.
    // Rule it protects: the safe-scheme guard admits http(s) so the anchor renders.
    routeApiGet(makeMeta())
    renderDrawer()
    await userEvent.click(screen.getByRole('tab', { name: 'URLs' }))
    await screen.findByText('Public URL')
    expect(screen.getByRole('link', { name: /open public url/i })).toBeInTheDocument()
  })

  it('hides the anchor when the public URL uses a non-http scheme', async () => {
    // Scenario: a hostile backend returns a javascript: URL.
    // Rule it protects: the safe-scheme guard rejects it, so no anchor is rendered
    // and the javascript: URL can never reach an href.
    routeApiGet(makeMeta(), 'javascript:alert(1)')
    renderDrawer()
    await userEvent.click(screen.getByRole('tab', { name: 'URLs' }))
    await screen.findByText('Public URL')
    expect(screen.queryByRole('link', { name: /open public url/i })).not.toBeInTheDocument()
  })

  it('hides the anchor when the public URL is unparseable', async () => {
    // Scenario: the URL string fails to parse (the guard's catch path).
    // Rule it protects: a malformed value is treated as unsafe, not rendered.
    routeApiGet(makeMeta(), 'not a valid url')
    renderDrawer()
    await userEvent.click(screen.getByRole('tab', { name: 'URLs' }))
    await screen.findByText('Public URL')
    expect(screen.queryByRole('link', { name: /open public url/i })).not.toBeInTheDocument()
  })

  it('surfaces a clipboard failure as an error toast', async () => {
    routeApiGet(makeMeta())
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    renderDrawer()
    await userEvent.click(screen.getByRole('tab', { name: 'URLs' }))
    await screen.findByText('Public URL')
    await userEvent.click(screen.getByRole('button', { name: /copy public url/i }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Clipboard write failed'))
  })

  it('issues a signed URL, masks it, and copies the full value', async () => {
    routeApiGet(makeMeta())
    apiPostMock.mockResolvedValue({
      url: 'http://localhost:9000/vault/docs/report.pdf?X-Amz-Signature=secret',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      requestedTtlSeconds: 300,
      effectiveTtlSeconds: 300,
      clamped: false,
      maxTtlSeconds: 3600,
    })
    renderDrawer()
    await userEvent.click(screen.getByRole('tab', { name: 'URLs' }))
    await userEvent.click(screen.getByRole('button', { name: /issue signed url/i }))
    expect(await screen.findByText(/\[signed-params-hidden\]/)).toBeInTheDocument()
    expect(screen.queryByText(/X-Amz-Signature=secret/)).not.toBeInTheDocument()
    // The issuance request targets the signed endpoint with the exact key + TTL.
    expect(apiPostMock).toHaveBeenCalledWith('/signed/download-url', {
      key: 'docs/report.pdf',
      ttlSeconds: 300,
    })
    await userEvent.click(screen.getByRole('button', { name: /copy signed url/i }))
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Signed URL copied'))
  })

  it('renders the open-in-new-tab anchor for an https public URL', async () => {
    // Scenario: an https URL is a distinct safe scheme from http; the guard must
    // admit it too, so the anchor renders (guards the https branch of the OR).
    routeApiGet(makeMeta(), 'https://cdn.example.com/vault/docs/report.pdf')
    renderDrawer()
    await userEvent.click(screen.getByRole('tab', { name: 'URLs' }))
    await screen.findByText('Public URL')
    const link = screen.getByRole('link', { name: /open public url/i })
    expect(link).toHaveAttribute('href', 'https://cdn.example.com/vault/docs/report.pdf')
  })

  it('renders [url-hidden] when the signed URL cannot be parsed', async () => {
    routeApiGet(makeMeta())
    apiPostMock.mockResolvedValue({
      url: 'not a url',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      requestedTtlSeconds: 300,
      effectiveTtlSeconds: 300,
      clamped: false,
      maxTtlSeconds: 3600,
    })
    renderDrawer()
    await userEvent.click(screen.getByRole('tab', { name: 'URLs' }))
    await userEvent.click(screen.getByRole('button', { name: /issue signed url/i }))
    expect(await screen.findByText('[url-hidden]')).toBeInTheDocument()
  })

  it('shows an error toast when signed URL issuance fails', async () => {
    routeApiGet(makeMeta())
    apiPostMock.mockRejectedValue(
      Object.assign(new Error('TTL invalid'), { code: 'STORAGE_SIGNED_URL_TTL_INVALID' }),
    )
    renderDrawer()
    await userEvent.click(screen.getByRole('tab', { name: 'URLs' }))
    await userEvent.click(screen.getByRole('button', { name: /issue signed url/i }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Signed URL: TTL invalid'))
  })
})
