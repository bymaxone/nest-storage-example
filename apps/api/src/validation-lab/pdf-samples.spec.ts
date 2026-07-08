/**
 * Unit: pdf-samples - forged and genuine PDF fixture builders.
 *
 * Covers the forged sample (plain text, no %PDF prefix) and the genuine sample
 * (real %PDF signature), each declaring the application/pdf content type so the
 * magic-byte validator engages.
 *
 * @module validation-lab/pdf-samples.spec
 */
import { forgedPdf, genuinePdf } from './pdf-samples.js'

describe('pdf-samples (unit)', () => {
  it('forgedPdf declares application/pdf without the %PDF signature', () => {
    /*
     * Scenario: the forged sample is built for the magic-byte demo.
     * Rule it protects: it declares application/pdf but its leading bytes are NOT
     * %PDF, so the validator will reject it.
     */
    const sample = forgedPdf()
    expect(sample.contentType).toBe('application/pdf')
    expect(sample.filename).toBe('forged.pdf')
    expect(sample.buffer.subarray(0, 4).toString('ascii')).not.toBe('%PDF')
    // Pin the exact forged body so a mutant that blanks it (and would then
    // trivially still fail the %PDF check) is caught.
    expect(sample.buffer.toString('utf8')).toBe(
      'This is plain text pretending to be a PDF document.\n',
    )
  })

  it('genuinePdf begins with the real %PDF signature', () => {
    /*
     * Scenario: the genuine sample is built for the magic-byte demo.
     * Rule it protects: its leading bytes ARE the %PDF signature, so the validator
     * passes it.
     */
    const sample = genuinePdf()
    expect(sample.contentType).toBe('application/pdf')
    expect(sample.filename).toBe('genuine.pdf')
    expect(sample.buffer.subarray(0, 4).toString('ascii')).toBe('%PDF')
  })
})
