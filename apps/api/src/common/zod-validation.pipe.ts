/**
 * @fileoverview A Zod-backed validation pipe for route inputs. A failure becomes
 * a structured HTTP 400 `{ error: { code: 'VALIDATION', issues: [{ path,
 * message }] } }`. It reports the offending path and Zod's message only, and
 * never echoes the received value, so untrusted input cannot leak back through
 * an error body.
 * @layer api/common
 */
import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common'
import type { ZodType } from 'zod'

/** Stable error code emitted for a validation failure. */
const VALIDATION_ERROR_CODE = 'VALIDATION'

/**
 * Validates a route input against a Zod schema. A `ZodError` becomes HTTP 400.
 *
 * Usage: `@Body(new ZodValidationPipe(createXSchema)) body: CreateX`.
 *
 * @template T - The parsed output type inferred from the schema.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  /**
   * Parses `value` through the schema and returns the typed result.
   *
   * @param value - The raw input from the route parameter.
   * @returns The validated, typed value.
   * @throws BadRequestException with a structured, value-free issue list.
   */
  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value)
    if (parsed.success) {
      return parsed.data
    }
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    throw new BadRequestException({ error: { code: VALIDATION_ERROR_CODE, issues } })
  }
}
