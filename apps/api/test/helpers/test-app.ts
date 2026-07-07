/**
 * Test app factory - boots the real application against a container MinIO.
 *
 * Points the validated environment at a Testcontainers MinIO endpoint, then
 * builds the production app through the same `createApp` seam the process
 * entrypoint uses, so the e2e suite exercises the actual wiring (the canonical
 * `BymaxStorageModule.forRootAsync`, the global filter, helmet).
 *
 * `createApp` is imported **dynamically, after** the env is set: the
 * `ConfigModule` validates `process.env` the moment its module metadata is
 * evaluated, so a static top-level import would freeze the default (localhost)
 * endpoint before the container URL is known. Jest gives each test file a fresh
 * module registry, so the deferred import re-validates with the right env once
 * per spec file.
 *
 * @module test/helpers/test-app
 */
import type { INestApplication } from '@nestjs/common'
import { MINIO_CREDENTIAL } from './minio-container.js'

/** The booted application plus its teardown handle. */
export interface TestApiApp {
  /** The initialized Nest application (all lifecycle hooks have run). */
  app: INestApplication
}

/**
 * Builds and initializes the production app against a container MinIO.
 *
 * @param endpoint - The MinIO endpoint (`StartedMinio.endpoint`).
 * @param env - Per-spec env overrides merged over the test baseline.
 * @returns The initialized application.
 * @throws When the module fails to compile or the connection cannot be opened.
 */
export async function createTestApp(
  endpoint: string,
  env: Readonly<Record<string, string>> = {},
): Promise<TestApiApp> {
  const baseline: Record<string, string> = {
    NODE_ENV: 'test',
    STORAGE_ENDPOINT: endpoint,
    STORAGE_REGION: 'us-east-1',
    STORAGE_BUCKET: 'vault',
    STORAGE_ARCHIVE_BUCKET: 'vault-archive',
    STORAGE_VERSIONED_BUCKET: 'vault-versioned',
    STORAGE_ACCESS_KEY_ID: MINIO_CREDENTIAL,
    STORAGE_SECRET_ACCESS_KEY: MINIO_CREDENTIAL,
    STORAGE_FORCE_PATH_STYLE: 'true',
    STORAGE_PUBLIC_BASE_URL: `${endpoint}/vault`,
    STORAGE_KEY_PREFIX: 'storage-example',
    STORAGE_MAX_TTL_SECONDS: '3600',
  }
  for (const [key, value] of Object.entries({ ...baseline, ...env })) {
    process.env[key] = value
  }

  // Deferred import: the ConfigModule validates process.env at metadata-eval
  // time, so createApp (and AppModule) must load only after the env is in place.
  const { createApp } = await import('../../src/app.factory.js')
  const app = await createApp()
  await app.init()
  return { app }
}
