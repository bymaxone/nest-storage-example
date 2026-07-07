/**
 * Unit: buildMulterOptions - the env-to-multer-options mapping.
 *
 * Asserts the multer `fileSize` limit reflects `UPLOAD_MAX_SIZE_BYTES` so multer
 * and the storage-layer size validation share one ceiling, for both the default
 * environment and a custom override.
 *
 * @module uploads/multer.config.spec
 */
import { envSchema } from '../config/env.schema.js'
import { buildMulterOptions } from './multer.config.js'

describe('buildMulterOptions', () => {
  it('pins the fileSize limit to the default UPLOAD_MAX_SIZE_BYTES', () => {
    /*
     * Scenario: the default environment is wired.
     * Rule it protects: multer's `fileSize` limit equals the env default so the
     * multipart body ceiling matches the storage-layer size validation.
     */
    const env = envSchema.parse({})

    const options = buildMulterOptions(env)

    expect(options.limits?.fileSize).toBe(26_214_400)
  })

  it('reflects a custom UPLOAD_MAX_SIZE_BYTES override', () => {
    /*
     * Scenario: the operator raises the upload ceiling via the env var.
     * Rule it protects: the limit is config-driven (not a hard-coded constant),
     * so multer tracks whatever the storage layer is configured to accept.
     */
    const env = envSchema.parse({ UPLOAD_MAX_SIZE_BYTES: '52428800' })

    const options = buildMulterOptions(env)

    expect(options.limits?.fileSize).toBe(52_428_800)
  })
})
