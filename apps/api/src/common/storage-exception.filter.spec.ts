/**
 * Unit: StorageExceptionFilter - relays the library envelope verbatim.
 *
 * Builds a real StorageException and a mock ArgumentsHost, then asserts the
 * filter writes the exception's own status and its `getResponse()` body
 * unchanged. A second code proves the status is read from the exception, not
 * hardcoded.
 *
 * @module common/storage-exception.filter.spec
 */
import { jest } from '@jest/globals'
import type { ArgumentsHost } from '@nestjs/common'
import { StorageException } from '@bymax-one/nest-storage'
import { StorageExceptionFilter } from './storage-exception.filter.js'

/**
 * Builds a mock ArgumentsHost whose HTTP response records status + json calls.
 *
 * @returns The host plus the `status` and `json` spies.
 */
function setup() {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost
  return { host, status, json }
}

describe('StorageExceptionFilter (unit)', () => {
  const filter = new StorageExceptionFilter()

  it('relays a not-found exception with its status and envelope', () => {
    /*
     * Scenario: a STORAGE_OBJECT_NOT_FOUND exception reaches the filter.
     * Rule it protects: the response status equals the exception's own status and
     * the body is the library envelope passed through unchanged.
     */
    const { host, status, json } = setup()
    const exception = new StorageException('STORAGE_OBJECT_NOT_FOUND')

    filter.catch(exception, host)

    expect(status).toHaveBeenCalledWith(exception.getStatus())
    expect(json).toHaveBeenCalledWith(exception.getResponse())
  })

  it('derives the status from the exception, not a constant', () => {
    /*
     * Scenario: a different code (STORAGE_MIME_NOT_ALLOWED) with its own status.
     * Rule it protects: the status is read from `getStatus()`, so distinct codes
     * yield distinct HTTP statuses.
     */
    const { host, status } = setup()
    const exception = new StorageException('STORAGE_MIME_NOT_ALLOWED')

    filter.catch(exception, host)

    expect(status).toHaveBeenCalledWith(exception.getStatus())
  })
})
