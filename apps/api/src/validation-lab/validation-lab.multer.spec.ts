/**
 * Unit: buildValidationLabMulterOptions - the env-to-multer-options mapping for
 * the validation lab.
 *
 * Asserts the multer `fileSize` cap is a generous multiple (x4) of
 * `UPLOAD_MAX_SIZE_BYTES` so it sits ABOVE the library size gate (a body just over
 * the library max still reaches the library to produce 413) while remaining bounded
 * to prevent a memory-exhaustion DoS.
 *
 * @module validation-lab/validation-lab.multer.spec
 */
import { envSchema } from '../config/env.schema.js'
import { buildValidationLabMulterOptions } from './validation-lab.multer.js'

describe('buildValidationLabMulterOptions', () => {
  it('caps fileSize at 4x the default UPLOAD_MAX_SIZE_BYTES', () => {
    /*
     * Scenario: the default environment is wired.
     * Rule it protects: multer's hard cap is a generous multiple of the library
     * size gate, so the library still produces the 413 envelope while an absurd
     * upload cannot exhaust memory first.
     */
    const env = envSchema.parse({})

    const options = buildValidationLabMulterOptions(env)

    expect(options.limits?.fileSize).toBe(26_214_400 * 4)
  })

  it('scales the cap with a custom UPLOAD_MAX_SIZE_BYTES override', () => {
    /*
     * Scenario: the operator raises the upload ceiling via the env var.
     * Rule it protects: the safety cap stays a fixed multiple above whatever the
     * library size gate is configured to, never an unbounded buffer.
     */
    const env = envSchema.parse({ UPLOAD_MAX_SIZE_BYTES: '52428800' })

    const options = buildValidationLabMulterOptions(env)

    expect(options.limits?.fileSize).toBe(52_428_800 * 4)
  })
})
