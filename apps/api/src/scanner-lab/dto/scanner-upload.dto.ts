/**
 * @fileoverview Zod schema and inferred type for `POST /scanner/upload`. The
 * body carries the text `content` whose inert demo marker drives the verdict and
 * an optional deterministic `keySeed` so a caller can predict the composed
 * object key (used to prove post-upload removal). No content type is accepted:
 * the lab always declares `text/plain`, which the MIME whitelist allows, so the
 * request always reaches the scanner stage.
 * @layer api/scanner-lab
 */
import { z } from 'zod'

/** Upper bound on the submitted text so a marker probe stays small. */
const MAX_CONTENT_LENGTH = 8192
/** Upper bound on the deterministic key seed. */
const MAX_KEY_SEED_LENGTH = 64

/** Body schema for `POST /scanner/upload`. */
export const scannerUploadBodySchema = z.object({
  /** Text content whose inert `X-DEMO-*` marker (if any) drives the verdict. */
  content: z.string().min(1).max(MAX_CONTENT_LENGTH),
  /** Optional deterministic key seed (safe path segment) for a predictable key. */
  keySeed: z
    .string()
    .min(1)
    .max(MAX_KEY_SEED_LENGTH)
    .regex(/^[a-zA-Z0-9-]+$/, 'keySeed must be alphanumeric or dash')
    .optional(),
})

/** Parsed body type for `POST /scanner/upload`. */
export type ScannerUploadBody = z.infer<typeof scannerUploadBodySchema>
