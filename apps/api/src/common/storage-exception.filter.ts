/**
 * @fileoverview Global exception filter for the library's `StorageException`.
 * It passes the library's error envelope through UNCHANGED: `StorageException`
 * already carries the public `{ error: { code, message, details } }` contract
 * (spec §18) and its own HTTP status, so re-shaping it here would fork the
 * contract. Errors that are not `StorageException` are left untouched for the
 * default handler, never swallowed by this filter.
 * @layer api/common
 */
import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'
import { StorageException } from '@bymax-one/nest-storage'

/** Relays every `StorageException` with its status and envelope intact. */
@Catch(StorageException)
export class StorageExceptionFilter implements ExceptionFilter {
  /**
   * Writes the exception's own status and response body to the HTTP response.
   *
   * @param exception - The thrown storage exception.
   * @param host - The arguments host used to reach the HTTP response.
   */
  catch(exception: StorageException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    response.status(exception.getStatus()).json(exception.getResponse())
  }
}
