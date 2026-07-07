/**
 * @fileoverview Zod schema and inferred type for `POST /signed/confirm`. After a
 * direct presigned PUT the server never saw the bytes, so the client calls
 * confirm with the object key; the service verifies the landed object via
 * `head()` against the configured size and MIME policy plus the scanner seam.
 * @layer api/signed
 */
import { z } from 'zod'
import { objectKeySchema } from '../../vault/dto/object-key.js'

/** Body schema for `POST /signed/confirm`. */
export const confirmBodySchema = z.object({
  /** Key of the object the client uploaded directly via a presigned PUT. */
  key: objectKeySchema,
})

/** Parsed body type for `POST /signed/confirm`. */
export type ConfirmBody = z.infer<typeof confirmBodySchema>
