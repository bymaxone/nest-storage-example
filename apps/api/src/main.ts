/**
 * @fileoverview Process entrypoint for the nest-storage-example API. Delegates
 * construction to `createApp()` and only owns the port binding and the
 * fail-fast exit on a boot error (e.g. an invalid environment). Graceful
 * shutdown is driven by `enableShutdownHooks()` inside the factory: on
 * SIGTERM/SIGINT Nest stops accepting connections, then the storage module
 * releases its S3 client's TCP connections via `onApplicationShutdown`.
 * @layer api/bootstrap
 */
import 'reflect-metadata'
import { ConfigService } from '@nestjs/config'
import { createApp } from './app.factory.js'
import type { Env } from './config/env.schema.js'

/** Boots the application and binds the HTTP listener on the validated `PORT`. */
async function bootstrap(): Promise<void> {
  const app = await createApp()
  const config = app.get<ConfigService<{ env: Env }, true>>(ConfigService)
  const { PORT } = config.get('env', { infer: true })
  await app.listen(PORT)
}

// A boot failure (including an aggregated environment-validation error) must
// print one readable message and exit non-zero so orchestration surfaces it.
bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
