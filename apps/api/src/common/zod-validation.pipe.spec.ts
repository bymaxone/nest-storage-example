/**
 * Unit: ZodValidationPipe - schema-backed 400 with a value-free issue list.
 *
 * Covers the pass-through of valid input, the structured rejection shape, and
 * the guarantee that a rejected payload's raw values never appear in the error
 * body.
 *
 * @module common/zod-validation.pipe.spec
 */
import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from './zod-validation.pipe.js'

/** A representative schema: a required name and a positive quantity. */
const schema = z.object({ name: z.string().min(1), quantity: z.number().int().positive() })

describe('ZodValidationPipe (unit)', () => {
  const pipe = new ZodValidationPipe(schema)

  it('returns the parsed value when input is valid', () => {
    /*
     * Scenario: a well-formed payload passes.
     * Rule it protects: the success arm returns the typed, parsed value.
     */
    expect(pipe.transform({ name: 'invoice', quantity: 3 })).toEqual({
      name: 'invoice',
      quantity: 3,
    })
  })

  it('throws a 400 with a code and per-issue path/message on invalid input', () => {
    /*
     * Scenario: two fields fail at once.
     * Rule it protects: the failure arm throws BadRequestException carrying
     * `{ error: { code: 'VALIDATION', issues: [{ path, message }] } }`.
     */
    let thrown: unknown
    try {
      pipe.transform({ name: '', quantity: -1 })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(BadRequestException)
    const body = (thrown as BadRequestException).getResponse() as {
      error: { code: string; issues: { path: string; message: string }[] }
    }
    expect(body.error.code).toBe('VALIDATION')
    expect(body.error.issues.map((issue) => issue.path)).toEqual(['name', 'quantity'])
    expect(body.error.issues.every((issue) => typeof issue.message === 'string')).toBe(true)
  })

  it('joins a nested issue path with dots', () => {
    /*
     * Scenario: a nested field fails inside a nested object schema.
     * Rule it protects: the issue path is joined with '.' (e.g. 'parent.child'),
     * so a mutant that blanks the join separator is caught.
     */
    const nested = new ZodValidationPipe(z.object({ parent: z.object({ child: z.string() }) }))
    let thrown: unknown
    try {
      nested.transform({ parent: { child: 123 } })
    } catch (error) {
      thrown = error
    }
    const body = (thrown as BadRequestException).getResponse() as {
      error: { issues: { path: string }[] }
    }
    expect(body.error.issues[0]?.path).toBe('parent.child')
  })

  it('never echoes a received value in the error body', () => {
    /*
     * Scenario: a secret-looking value fails validation.
     * Rule it protects: the error body reports the path and Zod message only, so
     * the raw input never leaks back to the caller.
     */
    const secret = 'leaky-secret-payload'
    let thrown: unknown
    try {
      pipe.transform({ name: 42, quantity: secret })
    } catch (error) {
      thrown = error
    }
    expect(JSON.stringify((thrown as BadRequestException).getResponse())).not.toContain(secret)
  })
})
