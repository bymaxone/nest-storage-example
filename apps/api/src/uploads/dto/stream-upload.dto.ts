/**
 * @fileoverview Zod schema and inferred type for the stream upload endpoint.
 * @layer api/uploads
 */
import { z } from 'zod'
import { UPLOAD_CATEGORIES } from './single-upload.dto.js'

/**
 * Query schema for `POST /uploads/stream`. The `knownSize` flag controls
 * whether the `Content-Length` header is forwarded to the library as `size`.
 * Omitting `size` forces the multipart path regardless of the threshold
 * (spec §12.2).
 */
export const streamUploadQuerySchema = z.object({
  /** Target category for key composition. */
  category: z.enum(UPLOAD_CATEGORIES),
  /**
   * When `'false'`, the size hint is omitted and the library is forced onto
   * the multipart path regardless of the `Content-Length` value.
   */
  knownSize: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v !== 'false'),
  /** Original filename used for extension extraction. Defaults to `'stream'`. */
  filename: z.string().optional(),
})

/** Parsed query type for `POST /uploads/stream`. */
export type StreamUploadQuery = z.infer<typeof streamUploadQuerySchema>
