/**
 * @fileoverview Unit tests for browser-side presigned PUT upload helpers.
 * @layer lib/direct-upload.test
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  putWithHeaders,
  splitIntoParts,
  partCount,
  MULTIPART_PART_SIZE_BYTES,
} from './direct-upload'

// ── XHR mock helpers ──────────────────────────────────────────────────────────

type ProgressHandler = (e: { lengthComputable: boolean; loaded: number; total: number }) => void
type LoadHandler = () => void
type ErrorHandler = () => void

interface MockXHRInstance {
  open: ReturnType<typeof vi.fn>
  setRequestHeader: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  upload: { addEventListener: ReturnType<typeof vi.fn> }
  addEventListener: ReturnType<typeof vi.fn>
  status: number
  _triggerLoad: () => void
  _triggerError: () => void
  _triggerProgress: (loaded: number, total: number, lengthComputable?: boolean) => void
}

function createMockXHR(overrideStatus = 200): MockXHRInstance {
  const loadHandlers: LoadHandler[] = []
  const errorHandlers: ErrorHandler[] = []
  const progressHandlers: ProgressHandler[] = []

  const instance: MockXHRInstance = {
    open: vi.fn(),
    setRequestHeader: vi.fn(),
    send: vi.fn(),
    status: overrideStatus,
    upload: {
      addEventListener: vi.fn((event: string, handler: ProgressHandler) => {
        if (event === 'progress') progressHandlers.push(handler)
      }),
    },
    addEventListener: vi.fn((event: string, handler: LoadHandler | ErrorHandler) => {
      if (event === 'load') loadHandlers.push(handler)
      if (event === 'error') errorHandlers.push(handler)
    }),
    _triggerLoad: () => loadHandlers.forEach((h) => h()),
    _triggerError: () => errorHandlers.forEach((h) => h()),
    _triggerProgress: (loaded: number, total: number, lengthComputable = true) =>
      progressHandlers.forEach((h) => h({ lengthComputable, loaded, total })),
  }
  return instance
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MULTIPART_PART_SIZE_BYTES', () => {
  it('equals 5 MiB (5 * 1024 * 1024)', () => {
    expect(MULTIPART_PART_SIZE_BYTES).toBe(5 * 1024 * 1024)
  })
})

describe('partCount', () => {
  it('returns 1 for a file smaller than partSize', () => {
    expect(partCount(1024, 5 * 1024 * 1024)).toBe(1)
  })

  it('returns 1 for a zero-byte file (minimum 1)', () => {
    expect(partCount(0, 5 * 1024 * 1024)).toBe(1)
  })

  it('returns 1 for a file exactly equal to partSize', () => {
    expect(partCount(5 * 1024 * 1024, 5 * 1024 * 1024)).toBe(1)
  })

  it('returns 2 for a file one byte larger than partSize', () => {
    expect(partCount(5 * 1024 * 1024 + 1, 5 * 1024 * 1024)).toBe(2)
  })

  it('returns 3 for a file spanning exactly 3 parts', () => {
    expect(partCount(3 * 5 * 1024 * 1024, 5 * 1024 * 1024)).toBe(3)
  })

  it('uses MULTIPART_PART_SIZE_BYTES as default partSize', () => {
    expect(partCount(MULTIPART_PART_SIZE_BYTES + 1)).toBe(2)
  })
})

describe('splitIntoParts', () => {
  const kb = 1024

  it('returns one slice for a file smaller than partSize', () => {
    const file = new File([new Uint8Array(10 * kb)], 'small.bin')
    const parts = splitIntoParts(file, 100 * kb)
    expect(parts).toHaveLength(1)
    expect(parts[0]?.size).toBe(10 * kb)
  })

  it('returns one slice for a file exactly equal to partSize', () => {
    const file = new File([new Uint8Array(100 * kb)], 'exact.bin')
    const parts = splitIntoParts(file, 100 * kb)
    expect(parts).toHaveLength(1)
    expect(parts[0]?.size).toBe(100 * kb)
  })

  it('splits a file into the correct number of parts', () => {
    const file = new File([new Uint8Array(250 * kb)], 'multi.bin')
    const parts = splitIntoParts(file, 100 * kb)
    expect(parts).toHaveLength(3)
    expect(parts[0]?.size).toBe(100 * kb)
    expect(parts[1]?.size).toBe(100 * kb)
    expect(parts[2]?.size).toBe(50 * kb)
  })

  it('uses MULTIPART_PART_SIZE_BYTES when no partSize supplied', () => {
    const file = new File([new Uint8Array(MULTIPART_PART_SIZE_BYTES + 1)], 'big.bin')
    const parts = splitIntoParts(file)
    expect(parts).toHaveLength(2)
  })
})

describe('putWithHeaders', () => {
  let xhrInstance: MockXHRInstance

  beforeEach(() => {
    xhrInstance = createMockXHR(200)
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(() => xhrInstance),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens XHR with PUT and the signed URL', async () => {
    const promise = putWithHeaders('https://s3.example.com/key?sig=abc', {}, new Blob(['data']))
    xhrInstance._triggerLoad()
    await promise
    expect(xhrInstance.open).toHaveBeenCalledWith('PUT', 'https://s3.example.com/key?sig=abc')
  })

  it('sets required headers', async () => {
    const headers = { 'Content-Type': 'image/png', 'x-amz-checksum': 'val' }
    const promise = putWithHeaders('https://s3.example.com/k?sig=x', headers, new Blob(['d']))
    xhrInstance._triggerLoad()
    await promise
    expect(xhrInstance.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'image/png')
    expect(xhrInstance.setRequestHeader).toHaveBeenCalledWith('x-amz-checksum', 'val')
  })

  it('sends the body', async () => {
    const blob = new Blob(['hello'])
    const promise = putWithHeaders('https://s3.example.com/k?sig=x', {}, blob)
    xhrInstance._triggerLoad()
    await promise
    expect(xhrInstance.send).toHaveBeenCalledWith(blob)
  })

  it('calls onProgress when lengthComputable', async () => {
    const onProgress = vi.fn()
    const promise = putWithHeaders(
      'https://s3.example.com/k?sig=x',
      {},
      new Blob(['data']),
      onProgress,
    )
    xhrInstance._triggerProgress(512, 1024, true)
    xhrInstance._triggerLoad()
    await promise
    expect(onProgress).toHaveBeenCalledWith(512, 1024)
  })

  it('does not call onProgress when not lengthComputable', async () => {
    const onProgress = vi.fn()
    const promise = putWithHeaders(
      'https://s3.example.com/k?sig=x',
      {},
      new Blob(['data']),
      onProgress,
    )
    xhrInstance._triggerProgress(512, 1024, false)
    xhrInstance._triggerLoad()
    await promise
    expect(onProgress).not.toHaveBeenCalled()
  })

  it('does not register progress listener when onProgress is omitted', async () => {
    const promise = putWithHeaders('https://s3.example.com/k?sig=x', {}, new Blob(['data']))
    xhrInstance._triggerLoad()
    await promise
    expect(xhrInstance.upload.addEventListener).not.toHaveBeenCalled()
  })

  it('resolves when XHR load fires with status 200', async () => {
    const promise = putWithHeaders('https://s3.example.com/k?sig=x', {}, new Blob(['d']))
    xhrInstance._triggerLoad()
    await expect(promise).resolves.toBeUndefined()
  })

  it('rejects with masked URL when XHR load fires with non-2xx status', async () => {
    xhrInstance.status = 403
    const promise = putWithHeaders('https://s3.example.com/key?sig=secret', {}, new Blob(['d']))
    xhrInstance._triggerLoad()
    await expect(promise).rejects.toThrow(
      'PUT to https://s3.example.com/key[signed-query-redacted] failed with status 403',
    )
  })

  it('rejects with masked URL on network error', async () => {
    const promise = putWithHeaders('https://s3.example.com/key?sig=secret', {}, new Blob(['d']))
    xhrInstance._triggerError()
    await expect(promise).rejects.toThrow(
      'Network error uploading to https://s3.example.com/key[signed-query-redacted]',
    )
  })

  it('masks an invalid URL in error messages', async () => {
    xhrInstance.status = 403
    const promise = putWithHeaders('not-a-valid-url', {}, new Blob(['d']))
    xhrInstance._triggerLoad()
    await expect(promise).rejects.toThrow('[url-redacted]')
  })
})
