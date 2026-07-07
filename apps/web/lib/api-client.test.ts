/**
 * @fileoverview Unit tests for the typed storage API client.
 * @layer lib/api-client.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StorageApiError, apiGet, apiPost, apiDelete, apiPostForm } from './api-client'

// ── fetch mock helpers ────────────────────────────────────────────────────────

function okResponse(data: unknown, status = 200): Response {
  return {
    ok: true,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(data),
  } as unknown as Response
}

function noBodyResponse(status: 204 | 200, contentLength?: string): Response {
  const headers = new Headers()
  if (contentLength !== undefined) headers.set('Content-Length', contentLength)
  return {
    ok: true,
    status,
    headers,
    json: () => Promise.reject(new Error('no body')),
  } as unknown as Response
}

function errorResponse(status: number, body: unknown, jsonThrows = false): Response {
  return {
    ok: false,
    status,
    headers: new Headers(),
    json: jsonThrows
      ? () => Promise.reject(new SyntaxError('bad json'))
      : () => Promise.resolve(body),
  } as unknown as Response
}

// ── StorageApiError ───────────────────────────────────────────────────────────

describe('StorageApiError', () => {
  it('sets name to StorageApiError', () => {
    const e = new StorageApiError('UNKNOWN', 'oops', 500)
    expect(e.name).toBe('StorageApiError')
  })

  it('sets code, status, and message', () => {
    const e = new StorageApiError('STORAGE_OBJECT_NOT_FOUND', 'not found', 404)
    expect(e.code).toBe('STORAGE_OBJECT_NOT_FOUND')
    expect(e.status).toBe(404)
    expect(e.message).toBe('not found')
  })

  it('sets details when provided', () => {
    const details = { key: 'foo/bar' }
    const e = new StorageApiError('UNKNOWN', 'msg', 400, details)
    expect(e.details).toEqual(details)
  })

  it('leaves details undefined when omitted', () => {
    const e = new StorageApiError('UNKNOWN', 'msg', 400)
    expect(e.details).toBeUndefined()
  })

  it('is an instance of Error', () => {
    const e = new StorageApiError('UNKNOWN', 'msg', 500)
    expect(e).toBeInstanceOf(Error)
  })
})

// ── apiGet ────────────────────────────────────────────────────────────────────

describe('apiGet', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls fetch with GET method and correct URL', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(okResponse({ id: 1 }))
    await apiGet('/health')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/health'),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('returns parsed JSON on 200', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(okResponse({ status: 'up' }))
    const result = await apiGet<{ status: string }>('/health')
    expect(result).toEqual({ status: 'up' })
  })

  it('returns undefined on 204', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(noBodyResponse(204))
    const result = await apiGet('/health')
    expect(result).toBeUndefined()
  })

  it('returns undefined when Content-Length is 0', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(noBodyResponse(200, '0'))
    const result = await apiGet('/health')
    expect(result).toBeUndefined()
  })

  it('throws StorageApiError with known code on typed error envelope', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(
      errorResponse(404, {
        error: { code: 'STORAGE_OBJECT_NOT_FOUND', message: 'key not found' },
      }),
    )
    await expect(apiGet('/vault/object?key=missing')).rejects.toMatchObject({
      code: 'STORAGE_OBJECT_NOT_FOUND',
      status: 404,
      message: 'key not found',
    })
  })

  it('throws StorageApiError with UNKNOWN code on unrecognised error code', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(
      errorResponse(500, {
        error: { code: 'MADE_UP_CODE', message: 'server error' },
      }),
    )
    await expect(apiGet('/health')).rejects.toMatchObject({ code: 'UNKNOWN', status: 500 })
  })

  it('throws StorageApiError with UNKNOWN code when response body is not JSON', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(errorResponse(503, null, true))
    await expect(apiGet('/health')).rejects.toMatchObject({ code: 'UNKNOWN', status: 503 })
  })

  it('throws StorageApiError with UNKNOWN code when body is not error envelope', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(errorResponse(500, { message: 'plain error' }))
    await expect(apiGet('/health')).rejects.toMatchObject({ code: 'UNKNOWN', status: 500 })
  })

  it('includes error details when present', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(
      errorResponse(400, {
        error: {
          code: 'STORAGE_VALIDATION_FAILED',
          message: 'validation failed',
          details: { field: 'key' },
        },
      }),
    )
    await expect(apiGet('/vault/object?key=bad')).rejects.toMatchObject({
      code: 'STORAGE_VALIDATION_FAILED',
      details: { field: 'key' },
    })
  })

  it('masks query strings in error messages from non-JSON responses', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValue(errorResponse(500, null, true))
    await expect(apiGet('/path?secret=value')).rejects.toThrow('[query-string-redacted]')
  })
})

// ── apiPost ───────────────────────────────────────────────────────────────────

describe('apiPost', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls fetch with POST and serialised JSON body', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(okResponse({ ok: true }))
    await apiPost('/signed/download-url', { key: 'foo' })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/signed/download-url'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'foo' }),
      }),
    )
  })

  it('calls fetch with POST and no body when body is undefined', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(okResponse({ ok: true }))
    await apiPost('/errors/STORAGE_TIMEOUT')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBeUndefined()
  })

  it('returns parsed JSON on success', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(okResponse({ url: 'https://example.com' }))
    const result = await apiPost<{ url: string }>('/signed/download-url', { key: 'k' })
    expect(result.url).toBe('https://example.com')
  })
})

// ── apiDelete ─────────────────────────────────────────────────────────────────

describe('apiDelete', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls fetch with DELETE method', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(okResponse({ deleted: true }))
    await apiDelete('/vault/object?key=foo')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/vault/object'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('serialises body when provided', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(okResponse({ deleted: true }))
    await apiDelete('/some/endpoint', { keys: ['a', 'b'] })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe(JSON.stringify({ keys: ['a', 'b'] }))
  })

  it('sends no body when body is undefined', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(okResponse({}))
    await apiDelete('/vault/object?key=foo')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBeUndefined()
  })
})

// ── apiPostForm ───────────────────────────────────────────────────────────────

describe('apiPostForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls fetch with POST and FormData body', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(okResponse({ key: 'uploads/file.png' }))
    const form = new FormData()
    form.append('file', new Blob(['data']), 'file.png')
    await apiPostForm('/uploads/single', form)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(form)
  })

  it('does not set Content-Type header (lets browser set multipart boundary)', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(okResponse({ key: 'k' }))
    const form = new FormData()
    await apiPostForm('/uploads/single', form)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    // init has no headers property at all (FormData call path omits it).
    expect((init as Record<string, unknown>)['headers']).toBeUndefined()
  })

  it('returns undefined on 204', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(noBodyResponse(204))
    const result = await apiPostForm('/uploads/single', new FormData())
    expect(result).toBeUndefined()
  })

  it('throws StorageApiError on non-2xx', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValueOnce(
      errorResponse(422, {
        error: { code: 'STORAGE_MIME_NOT_ALLOWED', message: 'mime not allowed' },
      }),
    )
    await expect(apiPostForm('/uploads/single', new FormData())).rejects.toMatchObject({
      code: 'STORAGE_MIME_NOT_ALLOWED',
      status: 422,
    })
  })

  it('returns JSON on 200', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    const payload = { key: 'uploads/img.jpg', bucket: 'vault', multipart: false }
    fetchMock.mockResolvedValueOnce(okResponse(payload))
    const result = await apiPostForm<typeof payload>('/uploads/single', new FormData())
    expect(result).toEqual(payload)
  })
})

describe('maskUrl fallback', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redacts the URL entirely when it cannot be parsed', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    // Non-JSON error body forces parseError to build a message via maskUrl.
    fetchMock.mockResolvedValue(errorResponse(500, null, true))
    // Force `new URL()` inside maskUrl to throw so the catch branch runs.
    const RealURL = globalThis.URL
    vi.stubGlobal(
      'URL',
      class {
        constructor() {
          throw new TypeError('invalid URL')
        }
      },
    )
    try {
      await apiGet('/anything')
      expect.unreachable('apiGet should reject on a 500 response')
    } catch (err) {
      const e = err as StorageApiError
      expect(e).toBeInstanceOf(StorageApiError)
      expect(e.code).toBe('UNKNOWN')
      expect(e.status).toBe(500)
      expect(e.message).toContain('[url-redacted]')
    } finally {
      vi.stubGlobal('URL', RealURL)
    }
  })
})
