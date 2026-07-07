/**
 * @fileoverview Shared Zod schema for an S3 object key. Enforces the provider
 * constraints once so every vault DTO validates keys identically: non-empty,
 * at most 1024 UTF-8 bytes (the S3 key-length limit, measured in bytes not
 * UTF-16 code units), and free of C0 control characters and DEL (which S3
 * rejects or silently transforms, producing opaque provider errors). The
 * byte-length refinement is exported so prefix/cursor fields share one
 * implementation.
 * @layer api/vault
 */
import { z } from 'zod'

/** Highest C0 control-character code point (US, 0x1f). */
const LAST_CONTROL_CODE = 0x1f
/** The DEL character code point (0x7f). */
const DELETE_CODE = 0x7f
/**
 * The S3 key/prefix/cursor byte ceiling. S3 bounds these by UTF-8 BYTE length,
 * not UTF-16 code-unit length, so a multi-byte string can pass `.max(1024)`
 * while exceeding the true provider limit.
 */
export const MAX_KEY_BYTES = 1024

/**
 * Zod refinement predicate asserting a string fits within `MAX_KEY_BYTES` UTF-8
 * bytes. Encoding once with `Buffer.byteLength` measures the actual wire size
 * S3 enforces, which `String.length` (code units) does not for non-ASCII input.
 *
 * @param value - The candidate key, prefix, or cursor.
 * @returns true when the UTF-8 byte length is at most `MAX_KEY_BYTES`.
 */
export function isWithinKeyByteLimit(value: string): boolean {
  return Buffer.byteLength(value, 'utf8') <= MAX_KEY_BYTES
}

/** Static, value-free message for a key/prefix/cursor byte-limit violation. */
export const KEY_BYTE_LIMIT_MESSAGE = `Value must not exceed ${MAX_KEY_BYTES} UTF-8 bytes.`

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
  .refine(isWithinKeyByteLimit, KEY_BYTE_LIMIT_MESSAGE)
  .refine(hasNoControlCharacters, 'Key must not contain control characters.')
