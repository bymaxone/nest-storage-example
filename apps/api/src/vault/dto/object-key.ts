/**
 * @fileoverview Shared Zod schema for an S3 object key. Enforces the provider
 * constraints once so every vault DTO validates keys identically: non-empty,
 * at most 1024 bytes (the S3 key-length limit), and free of C0 control
 * characters and DEL (which S3 rejects or silently transforms, producing
 * opaque provider errors).
 * @layer api/vault
 */
import { z } from 'zod'

/** Highest C0 control-character code point (US, 0x1f). */
const LAST_CONTROL_CODE = 0x1f
/** The DEL character code point (0x7f). */
const DELETE_CODE = 0x7f

/**
 * Returns true when the key is free of C0 control characters and DEL. All
 * other code points -- printable ASCII and higher Unicode used in legitimate
 * key paths -- are allowed.
 *
 * @param key - The candidate object key.
 * @returns true when no control character is present.
 */
function hasNoControlCharacters(key: string): boolean {
  for (let index = 0; index < key.length; index += 1) {
    // charCodeAt returns a number (never undefined) for an in-range index;
    // control characters and DEL all live in the BMP as single code units.
    const code = key.charCodeAt(index)
    if (code <= LAST_CONTROL_CODE || code === DELETE_CODE) {
      return false
    }
  }
  return true
}

/**
 * Schema for a single S3 object key. Reused across the download, delete, and
 * copy DTOs so key validation stays consistent at every boundary.
 */
export const objectKeySchema = z
  .string()
  .min(1)
  .max(1024)
  .refine(hasNoControlCharacters, 'Key must not contain control characters.')
