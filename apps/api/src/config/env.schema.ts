/**
 * @fileoverview The single source of environment truth. Every process variable
 * (spec §9.1) is declared, typed, coerced, and defaulted here with Zod, and this
 * is the ONLY module in the app permitted to read `process.env`. `loadEnv`
 * namespaces the validated result under an `env` key so the rest of the app
 * consumes it through `ConfigService<{ env: Env }, true>` — never a raw process
 * lookup. A misconfiguration throws one aggregated, value-free report at boot.
 * @layer api/config
 */
import { z } from 'zod'

/**
 * Parses an environment boolean WITHOUT `z.coerce.boolean()`, whose
 * `Boolean('false') === true` trap would silently invert a `'false'` string.
 * Only a real `true`, `'true'`, or `'1'` is truthy; everything else is false.
 *
 * @param defaultValue - The value applied when the variable is absent.
 * @returns A Zod schema resolving to a strict boolean.
 */
const envBoolean = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .default(defaultValue)
    .transform((value) => value === true || value === 'true' || value === '1')

/** Zod schema for every API environment variable (spec §9.1). */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  STORAGE_ENDPOINT: z.string().url().default('http://localhost:9000'),
  STORAGE_REGION: z.string().min(1).default('us-east-1'),
  STORAGE_BUCKET: z.string().min(1).default('vault'),
  STORAGE_ARCHIVE_BUCKET: z.string().min(1).default('vault-archive'),
  STORAGE_VERSIONED_BUCKET: z.string().min(1).default('vault-versioned'),
  STORAGE_ACCESS_KEY_ID: z.string().min(1).default('minioadmin'),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1).default('minioadmin'),
  STORAGE_FORCE_PATH_STYLE: envBoolean(true),
  STORAGE_PUBLIC_BASE_URL: z.string().url().default('http://localhost:9000/vault'),
  // Empty means "no CDN"; a non-empty value must be a valid URL.
  STORAGE_CDN_BASE_URL: z.union([z.literal(''), z.string().url()]).default(''),
  STORAGE_KEY_PREFIX: z.string().default('storage-example'),
  // Empty means "no global SSE"; otherwise one of the S3 SSE algorithms.
  STORAGE_SSE: z.union([z.literal(''), z.enum(['AES256', 'aws:kms'])]).default(''),
  STORAGE_CHECKSUM_MODE: z.enum(['WHEN_REQUIRED', 'WHEN_SUPPORTED']).default('WHEN_REQUIRED'),
  STORAGE_MAX_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  STORAGE_MULTIPART_THRESHOLD: z.coerce.number().int().positive().default(5_242_880),
  SCANNER_MODE: z.enum(['pre-upload', 'post-upload']).default('pre-upload'),
  SCANNER_REJECT_ON_UNKNOWN: envBoolean(false),
  UPLOAD_MAX_SIZE_BYTES: z.coerce.number().int().positive().default(26_214_400),
})

/** Fully-typed, validated environment shape. */
export type Env = z.infer<typeof envSchema>

/**
 * Validates raw environment input and returns the typed `Env`, or throws ONE
 * aggregated error. The message lists every offending variable by NAME and issue
 * code only — never the received value — so secrets can never leak into logs.
 *
 * @param config - The raw `process.env`-shaped record to validate.
 * @returns The parsed, typed environment.
 * @throws Error listing every failing variable when validation fails.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config)
  if (parsed.success) {
    return parsed.data
  }
  const lines = parsed.error.issues.map((issue) => {
    const name = issue.path.length > 0 ? issue.path.join('.') : '(root)'
    return `  - ${name}: ${issue.code}`
  })
  throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`)
}

/**
 * Reads and validates `process.env` at boot, namespacing the result under `env`
 * for `@nestjs/config`. This is the sole `process.env` access point in the app;
 * a validation failure throws here and aborts bootstrap (fail-fast).
 *
 * @returns The validated environment under the `env` namespace key.
 * @throws Error when the process environment fails validation.
 */
export function loadEnv(): { env: Env } {
  return { env: validateEnv(process.env) }
}
