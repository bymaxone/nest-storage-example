/**
 * @fileoverview Credential redaction for the config-introspection surface. The
 * `/system/config` endpoint proves what the module resolved to, but must never
 * expose secrets: `accessKeyId` is masked to its first four characters,
 * `secretAccessKey` and any `sessionToken` are replaced by a redaction marker.
 * The function never mutates its input: when credentials are present it returns
 * a redacted copy, and when they are absent it returns the options unchanged.
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
 * Redacts the storage options for safe serialization: the access key id is
 * masked and the secret access key and any session token are fully redacted.
 * When credentials are present a redacted copy is returned; when they are absent
 * (an unconfigured module) the input options are returned unchanged. The input
 * is never mutated either way.
 *
 * @param options - The resolved storage options to redact.
 * @returns Options safe to serialize: a redacted copy when credentials are
 *   present, otherwise the input options unchanged.
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
