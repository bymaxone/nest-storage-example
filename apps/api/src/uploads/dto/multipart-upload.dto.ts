/**
 * @fileoverview Zod schema and inferred type for the multipart upload endpoint.
 * @layer api/uploads
 */
import { z } from 'zod'
import { UPLOAD_CATEGORIES } from './single-upload.dto.js'

/**
 * Body schema for `POST /uploads/multipart`. Only the category is required;
 * the strategy decision (single vs multipart) comes from the file size and
 * the library's configured `thresholdBytes`.
 */
export const multipartUploadBodySchema = z.object({
  /** Target category for key composition. */
  category: z.enum(UPLOAD_CATEGORIES),
})

/** Parsed body type for `POST /uploads/multipart`. */
export type MultipartUploadBody = z.infer<typeof multipartUploadBodySchema>
