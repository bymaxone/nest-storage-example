/**
 * @fileoverview Shared Zod building blocks for the signed-surface DTOs. Kept in
 * one place so the presigned endpoints validate character sets and MIME types
 * identically and a single edit changes every route's behavior.
 * @layer api/signed
 */
import { z } from 'zod'

/** Printable ASCII only (space through tilde); rejects CR/LF and control bytes. */
export const PRINTABLE_ASCII = /^[\x20-\x7E]+$/

/**
 * MIME type folded into an upload signature: bounded, control-free, and a valid
 * `type/subtype`. A mismatch at PUT time yields `SignatureDoesNotMatch`.
 */
export const contentTypeSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(PRINTABLE_ASCII)
  .regex(/^[^/]+\/[^/]+$/, 'contentType must be a valid type/subtype')
