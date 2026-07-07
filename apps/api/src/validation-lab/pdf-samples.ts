/**
 * @fileoverview Representative sample bodies for demonstrating the magic-byte
 * validator (`PdfMagicByteValidator`). `forgedPdf()` declares `application/pdf`
 * but carries plain text, so the validator rejects it with
 * `STORAGE_VALIDATION_FAILED`; `genuinePdf()` carries the real `%PDF` signature,
 * so it passes. These builders are the inputs the validation lab is exercised
 * with (from the app's own e2e and manual probes); they intentionally contain no
 * scanner markers so they isolate the content-sniffing stage (spec §16).
 * @layer api/validation-lab
 */

/** A sample upload body plus the content type and filename to declare for it. */
export interface PdfSample {
  /** The raw bytes to upload. */
  buffer: Buffer
  /** The content type to declare on the multipart part. */
  contentType: string
  /** The filename to declare on the multipart part. */
  filename: string
}

/** The content type every sample declares, so the PDF validator engages. */
const PDF_CONTENT_TYPE = 'application/pdf'

/**
 * Builds a forged PDF: plain text bytes declared as `application/pdf`. Its
 * leading bytes are not `%PDF`, so the magic-byte validator rejects it.
 *
 * @returns The forged sample (text body, PDF content type).
 */
export function forgedPdf(): PdfSample {
  return {
    buffer: Buffer.from('This is plain text pretending to be a PDF document.\n', 'utf8'),
    contentType: PDF_CONTENT_TYPE,
    filename: 'forged.pdf',
  }
}

/**
 * Builds a genuine PDF: a minimal body whose leading bytes are the real `%PDF`
 * signature, so the magic-byte validator passes it.
 *
 * @returns The genuine sample (%PDF-prefixed body, PDF content type).
 */
export function genuinePdf(): PdfSample {
  return {
    buffer: Buffer.from('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<< >>\nendobj\n', 'binary'),
    contentType: PDF_CONTENT_TYPE,
    filename: 'genuine.pdf',
  }
}
