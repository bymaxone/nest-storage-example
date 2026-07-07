/**
 * Unit: PdfMagicByteValidator - the declared-PDF signature guard.
 *
 * Covers all four branches: non-PDF content passes, a PDF without a `readBytes`
 * peek passes, a real `%PDF` header passes, and a forged PDF (wrong leading
 * bytes) is rejected with a precise reason.
 *
 * @module validation-lab/pdf-magic-byte.validator.spec
 */
import type { IUploadValidator } from '@bymax-one/nest-storage'
import { PdfMagicByteValidator } from './pdf-magic-byte.validator.js'

/** Validation context accepted by the validator. */
type ValidatorContext = Parameters<IUploadValidator['validate']>[0]

/**
 * Builds a validation context with sensible defaults, overridable per test.
 *
 * @param overrides - Fields to override on the base context.
 * @returns A validation context for `validate`.
 */
function context(overrides: Partial<ValidatorContext>): ValidatorContext {
  return { key: 'doc.pdf', contentType: 'application/pdf', ...overrides }
}

describe('PdfMagicByteValidator (unit)', () => {
  const validator = new PdfMagicByteValidator()

  it('exposes the pdf-magic-byte name', () => {
    /*
     * Scenario: read the validator identity.
     * Rule it protects: the name is stable so it appears in validation-failed
     * error details.
     */
    expect(validator.name).toBe('pdf-magic-byte')
  })

  it('passes content that is not declared as PDF', async () => {
    /*
     * Scenario: a plain-text upload flows through.
     * Rule it protects: the first `||` operand short-circuits, so the validator
     * only guards declared PDFs.
     */
    const result = await validator.validate(
      context({ contentType: 'text/plain', readBytes: () => Promise.resolve(Buffer.of()) }),
    )
    expect(result).toEqual({ ok: true })
  })

  it('passes a declared PDF when no readBytes peek is available', async () => {
    /*
     * Scenario: a streamed PDF arrives without a non-consuming peek.
     * Rule it protects: the second `||` operand (`!readBytes`) short-circuits so
     * the validator never blocks input it cannot verify.
     */
    const result = await validator.validate(context({}))
    expect(result).toEqual({ ok: true })
  })

  it('passes a declared PDF whose leading bytes are the %PDF signature', async () => {
    /*
     * Scenario: a genuine PDF header is peeked.
     * Rule it protects: a `%PDF` prefix yields a passing result.
     */
    const result = await validator.validate(
      context({ readBytes: (n) => Promise.resolve(Buffer.from('%PDF-1.7').subarray(0, n)) }),
    )
    expect(result).toEqual({ ok: true })
  })

  it('rejects a declared PDF whose leading bytes are not %PDF', async () => {
    /*
     * Scenario: a text file renamed `.pdf` is peeked.
     * Rule it protects: a non-`%PDF` prefix is rejected with a precise reason,
     * catching the forgery before it reaches the bucket.
     */
    const result = await validator.validate(
      context({ readBytes: () => Promise.resolve(Buffer.from('junk')) }),
    )
    expect(result).toEqual({
      ok: false,
      reason: 'Declared as PDF but missing the %PDF magic bytes',
    })
  })
})
