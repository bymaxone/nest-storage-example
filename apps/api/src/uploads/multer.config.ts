/**
 * @fileoverview Builds the multer options from the validated environment so the
 * multipart body-size ceiling multer enforces matches the storage-layer size
 * validation. Registering these options through `MulterModule.registerAsync`
 * lets every `FileInterceptor` inherit a single, config-driven `fileSize` limit
 * instead of a hard-coded constant.
 * @layer api/uploads
 */
import type { MulterModuleOptions } from '@nestjs/platform-express'
import type { Env } from '../config/env.schema.js'

/**
 * Maps the validated environment onto multer options, pinning the accepted
 * multipart file size to `UPLOAD_MAX_SIZE_BYTES` so multer and the storage-layer
 * size validation (`buildStorageOptions`) agree on one ceiling.
 *
 * @param env - The Zod-validated environment.
 * @returns The multer module options with the config-driven `fileSize` limit.
 */
export const buildMulterOptions = (env: Env): MulterModuleOptions => ({
  limits: { fileSize: env.UPLOAD_MAX_SIZE_BYTES },
})
