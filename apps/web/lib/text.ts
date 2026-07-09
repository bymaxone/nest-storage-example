/**
 * @fileoverview Text helpers for preparing demo upload bodies. The example's
 * text-body upload endpoints cap the payload at 64 KiB measured in bytes, so
 * the dashboard truncates on a UTF-8 byte boundary rather than by string
 * length — a plain `String.slice` counts UTF-16 code units and can both
 * overshoot the byte cap for multi-byte text and split a surrogate pair.
 * @layer lib/text
 */

/** Maximum text-body size (bytes) accepted by the demo upload endpoints (64 KiB). */
export const MAX_TEXT_UPLOAD_BYTES = 65_536

/**
 * Truncates a string so its UTF-8 encoding is at most `maxBytes`, never
 * splitting a multi-byte sequence. Returns the input unchanged when it already
 * fits within the limit.
 *
 * @param input - The source text.
 * @param maxBytes - Maximum allowed UTF-8 byte length.
 * @returns The input, or a prefix whose UTF-8 encoding is at most `maxBytes` bytes.
 */
export function truncateToByteLength(input: string, maxBytes: number): string {
  // `encodeInto` writes only whole UTF-8 sequences that fit the destination, so
  // it never leaves a partial character; `read` is the count of consumed source
  // code units — equal to the input length only when the whole string fit.
  const buffer = new Uint8Array(maxBytes)
  const { read, written } = new TextEncoder().encodeInto(input, buffer)
  if (read === input.length) return input
  return new TextDecoder().decode(buffer.subarray(0, written))
}
