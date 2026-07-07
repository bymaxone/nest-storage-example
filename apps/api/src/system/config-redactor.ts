/**
 * @fileoverview Credential redaction and introspection rendering for the
 * `/system/config` surface. The endpoint proves what the module resolved to, but
 * must never expose secrets and must render its live plugins introspectably:
 * `accessKeyId` is masked to its first four characters, `secretAccessKey` and any
 * `sessionToken` are replaced by a redaction marker, the scanner `impl` and each
 * custom validator are summarized by NAME (never serialized as an opaque `{}`),
 * and the scanner `mode` and `rejectOnUnknown` are surfaced as plain values. The
 * function never mutates its input; it returns a rendered copy.
 * @layer api/system
 */
import type { BymaxStorageModuleOptions } from '@bymax-one/nest-storage'

/** Marker substituted for fully-hidden secret values. */
const REDACTED = '[redacted]'
/** Number of leading `accessKeyId` characters kept visible. */
const VISIBLE_KEY_CHARS = 4

/** Storage options whose credentials may be absent (unconfigured module). */
export type RedactableStorageOptions = Omit<BymaxStorageModuleOptions, 'credentials'> & {
  credentials?: BymaxStorageModuleOptions['credentials']
}

/** The scanner block rendered for introspection: the impl summarized by name. */
export interface RenderedScanner {
  /** Class name of the scanner implementation (never the live instance). */
  impl: string
  /** Resolved scan mode. */
  mode?: 'pre-upload' | 'post-upload'
  /** Whether an `unknown` verdict is rejected. */
  rejectOnUnknown?: boolean
}

/** The validation block rendered for introspection: validators summarized by name. */
export interface RenderedValidation {
  /** MIME whitelist (exact or `type/*` wildcard entries). */
  mimeWhitelist?: readonly string[]
  /** Maximum accepted upload size in bytes. */
  maxSizeBytes?: number
  /** Names of the configured custom validators, in order. */
  customValidators?: readonly string[]
}

/** Storage options rendered safe and introspectable for serialization. */
export type RedactedStorageOptions = Omit<RedactableStorageOptions, 'scanner' | 'validation'> & {
  scanner?: RenderedScanner
  validation?: RenderedValidation
}

/**
 * Masks an access key id to its first four characters, replacing the remainder
 * with asterisks.
 *
 * @param accessKeyId - The raw access key id.
 * @returns The masked access key id.
 */
function maskAccessKeyId(accessKeyId: string): string {
  const visible = accessKeyId.slice(0, VISIBLE_KEY_CHARS)
  const hiddenCount = Math.max(accessKeyId.length - VISIBLE_KEY_CHARS, 0)
  return `${visible}${'*'.repeat(hiddenCount)}`
}

/**
 * Redacts credentials for safe serialization: the access key id is masked and
 * the secret access key and any session token are fully hidden.
 *
 * @param credentials - The raw credentials to redact.
 * @returns The redacted credentials copy.
 */
function redactCredentials(
  credentials: NonNullable<BymaxStorageModuleOptions['credentials']>,
): NonNullable<BymaxStorageModuleOptions['credentials']> {
  return {
    accessKeyId: maskAccessKeyId(credentials.accessKeyId),
    secretAccessKey: REDACTED,
    ...(credentials.sessionToken !== undefined ? { sessionToken: REDACTED } : {}),
  }
}

/**
 * Renders the scanner block by summarizing the live implementation with its
 * class name and surfacing the resolved mode and reject flag as plain values.
 *
 * @param scanner - The resolved scanner block carrying a live `impl`.
 * @returns The introspectable scanner view.
 */
function renderScanner(
  scanner: NonNullable<BymaxStorageModuleOptions['scanner']>,
): RenderedScanner {
  return {
    impl: scanner.impl.constructor.name,
    ...(scanner.mode !== undefined ? { mode: scanner.mode } : {}),
    ...(scanner.rejectOnUnknown !== undefined ? { rejectOnUnknown: scanner.rejectOnUnknown } : {}),
  }
}

/**
 * Renders the validation block by summarizing each custom validator with its
 * name, leaving the whitelist and size cap as plain values.
 *
 * @param validation - The resolved validation block carrying live validators.
 * @returns The introspectable validation view.
 */
function renderValidation(
  validation: NonNullable<BymaxStorageModuleOptions['validation']>,
): RenderedValidation {
  return {
    ...(validation.mimeWhitelist !== undefined ? { mimeWhitelist: validation.mimeWhitelist } : {}),
    ...(validation.maxSizeBytes !== undefined ? { maxSizeBytes: validation.maxSizeBytes } : {}),
    ...(validation.customValidators !== undefined
      ? { customValidators: validation.customValidators.map((validator) => validator.name) }
      : {}),
  }
}

/**
 * Renders the storage options safe to serialize and fully introspectable:
 * credentials are redacted, and the scanner and validator plugins are summarized
 * by name with their resolved settings surfaced as plain values. The input is
 * never mutated; a rendered copy is always returned.
 *
 * @param options - The resolved storage options to render.
 * @returns A credential-safe, introspectable copy of the options.
 */
export function redactStorageOptions(options: RedactableStorageOptions): RedactedStorageOptions {
  const { credentials, scanner, validation, ...rest } = options
  const rendered: RedactedStorageOptions = { ...rest }
  if (credentials !== undefined) {
    rendered.credentials = redactCredentials(credentials)
  }
  if (scanner !== undefined) {
    rendered.scanner = renderScanner(scanner)
  }
  if (validation !== undefined) {
    rendered.validation = renderValidation(validation)
  }
  return rendered
}
