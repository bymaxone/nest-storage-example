/**
 * @fileoverview Typed HTTP client for the storage API. Every response is
 * typed against the backend's error envelope using STORAGE_ERROR_CODES from
 * the shared subpath. Signed URLs are treated as credentials: any error that
 * would include a presigned URL in its message has the query-string stripped
 * before the error is thrown.
 * @layer lib/api-client
 */
import {
  STORAGE_ERROR_CODES,
  type StorageErrorCode,
  type StorageErrorResponse,
} from '@bymax-one/nest-storage/shared'
import { API_BASE_URL } from './constants'

/** All valid storage error codes as a set for runtime narrowing. */
const KNOWN_CODES = new Set<string>(Object.values(STORAGE_ERROR_CODES))

/** Typed error thrown by the storage API. */
export class StorageApiError extends Error {
  /** The storage error code (one of STORAGE_ERROR_CODES). */
  readonly code: StorageErrorCode | 'UNKNOWN'
  /** HTTP status code from the response. */
  readonly status: number
  /** Optional structured details from the error body. */
  readonly details: Record<string, unknown> | undefined

  constructor(
    code: StorageErrorCode | 'UNKNOWN',
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'StorageApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

/** Strips query strings from a URL so presigned credentials are never logged. */
function maskUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}[query-string-redacted]`
  } catch {
    return '[url-redacted]'
  }
}

/** Narrows a raw code string to a known StorageErrorCode or 'UNKNOWN'. */
function toCode(raw: unknown): StorageErrorCode | 'UNKNOWN' {
  if (typeof raw === 'string' && KNOWN_CODES.has(raw)) return raw as StorageErrorCode
  return 'UNKNOWN'
}

/** Parses a failed Response into a StorageApiError. */
async function parseError(res: Response, requestUrl: string): Promise<StorageApiError> {
  const masked = maskUrl(requestUrl)
  let body: unknown
  try {
    body = await res.json()
  } catch {
    return new StorageApiError('UNKNOWN', `HTTP ${res.status} from ${masked}`, res.status)
  }
  if (isErrorEnvelope(body)) {
    return new StorageApiError(
      toCode(body.error.code),
      body.error.message,
      res.status,
      body.error.details,
    )
  }
  return new StorageApiError('UNKNOWN', `HTTP ${res.status} from ${masked}`, res.status)
}

/** Type guard for the library's error envelope shape. */
function isErrorEnvelope(v: unknown): v is StorageErrorResponse {
  return (
    typeof v === 'object' &&
    v !== null &&
    'error' in v &&
    typeof (v as StorageErrorResponse).error === 'object' &&
    typeof (v as StorageErrorResponse).error.code === 'string' &&
    typeof (v as StorageErrorResponse).error.message === 'string'
  )
}

/** Core fetch wrapper: resolves on 2xx, rejects with StorageApiError otherwise. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) throw await parseError(res, url)
  if (res.status === 204 || res.headers.get('Content-Length') === '0') return undefined as T
  return res.json() as Promise<T>
}

/** Issues a GET request. */
export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}

/** Issues a POST request with a JSON body. */
export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

/** Issues a DELETE request. */
export function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'DELETE',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

/** Issues a POST request with a FormData body (multipart upload). */
export function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const url = `${API_BASE_URL}${path}`
  return fetch(url, { method: 'POST', body: form }).then(async (res) => {
    if (!res.ok) throw await parseError(res, url)
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  })
}

export type { StorageErrorCode }
