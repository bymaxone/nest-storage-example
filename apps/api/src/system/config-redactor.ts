/**
 * @fileoverview Credential redaction for the config-introspection surface. The
 * `/system/config` endpoint proves what the module resolved to, but must never
 * expose secrets: `accessKeyId` is masked to its first four characters,
 * `secretAccessKey` and any `sessionToken` are replaced by a redaction marker.
 * The function is pure and clones its input, so the live options are untouched.
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
 * Returns a redacted clone of the storage options: the access key id is masked,
 * the secret access key and any session token are fully redacted. Options
 * without credentials (an unconfigured module) are returned unchanged.
 *
 * @param options - The resolved storage options to redact.
 * @returns A clone safe to serialize in an introspection response.
 */
export function redactStorageOptions(options: RedactableStorageOptions): RedactableStorageOptions {
  if (!options.credentials) {
    return options
  }
  const { accessKeyId, sessionToken } = options.credentials
  return {
    ...options,
    credentials: {
      accessKeyId: maskAccessKeyId(accessKeyId),
      secretAccessKey: REDACTED,
      ...(sessionToken !== undefined ? { sessionToken: REDACTED } : {}),
    },
  }
}
