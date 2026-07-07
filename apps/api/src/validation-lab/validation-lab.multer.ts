/**
 * @fileoverview Builds the validation-lab multer options. The lab wants the
 * LIBRARY to be the size gate (an oversized body must reach the pipeline to be
 * rejected with `STORAGE_SIZE_EXCEEDED`), so multer's `fileSize` is set to a
 * generous multiple of `UPLOAD_MAX_SIZE_BYTES`: high enough that a body just over
 * the library max still reaches the library to produce the 413 envelope, but
 * bounded so an absurdly large upload cannot exhaust process memory before
 * validation runs (defense in depth against a memory-exhaustion DoS).
 * @layer api/validation-lab
 */
import type { MulterModuleOptions } from '@nestjs/platform-express'
import type { Env } from '../config/env.schema.js'

/** Multiplier applied to the library size cap to derive multer's hard safety limit. */
const SAFETY_MARGIN = 4

/**
 * Maps the validated environment onto the validation-lab multer options with a
 * generous hard `fileSize` cap (`UPLOAD_MAX_SIZE_BYTES` times the safety margin).
 * The cap sits above the library's size gate so the library still produces the
 * 413 envelope for a body over its own max, while bounding in-memory buffering.
 *
 * @param env - The Zod-validated environment.
 * @returns The multer module options with the safety-capped `fileSize` limit.
 */
export const buildValidationLabMulterOptions = (env: Env): MulterModuleOptions => ({
  limits: { fileSize: env.UPLOAD_MAX_SIZE_BYTES * SAFETY_MARGIN },
})
