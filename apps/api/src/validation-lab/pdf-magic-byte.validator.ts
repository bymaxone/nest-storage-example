/**
 * @fileoverview A minimal magic-byte upload validator: it confirms that content
 * declared as `application/pdf` actually begins with the `%PDF` signature, so a
 * text file merely renamed `.pdf` is rejected before it reaches the bucket. It
 * is a small, stable member of the library's `IUploadValidator` chain; the full
 * validation lab builds on it.
 * @layer api/validation-lab
 */
import type { IUploadValidator } from '@bymax-one/nest-storage'

/** The PDF file signature - the first four bytes of every well-formed PDF. */
const PDF_MAGIC = '%PDF'
/** Number of leading bytes to sniff for the signature. */
const MAGIC_BYTE_COUNT = 4

/** Validation context accepted by every `IUploadValidator`. */
type ValidatorContext = Parameters<IUploadValidator['validate']>[0]
/** Result returned by every `IUploadValidator`. */
type ValidatorResult = Awaited<ReturnType<IUploadValidator['validate']>>

/**
 * Rejects content declared as PDF whose leading bytes are not the `%PDF`
 * signature. Non-PDF content and streams without a `readBytes` peek pass
 * untouched, so the validator only guards the case it can actually verify.
 */
export class PdfMagicByteValidator implements IUploadValidator {
  /** Identifies this validator in `STORAGE_VALIDATION_FAILED` error details. */
  readonly name = 'pdf-magic-byte'

  /**
   * Validates the declared PDF content type against the real leading bytes.
   *
   * @param context - The upload context (content type + non-consuming peek).
   * @returns A passing result for non-PDF or unpeekable input, otherwise a
   *   pass/fail decision based on the `%PDF` signature.
   */
  async validate(context: ValidatorContext): Promise<ValidatorResult> {
    if (context.contentType !== 'application/pdf' || !context.readBytes) {
      return { ok: true }
    }
    const head = await context.readBytes(MAGIC_BYTE_COUNT)
    return head.toString('ascii') === PDF_MAGIC
      ? { ok: true }
      : { ok: false, reason: 'Declared as PDF but missing the %PDF magic bytes' }
  }
}
