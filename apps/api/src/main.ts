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
import { createApp } from './app.factory.js'

/** Port the API listens on until the validated config layer supplies `PORT`. */
const DEFAULT_PORT = 3001

/** Boots the application and binds the HTTP listener. */
async function bootstrap(): Promise<void> {
  const app = await createApp()
  await app.listen(DEFAULT_PORT)
}

// A boot failure (including an aggregated environment-validation error) must
// print one readable message and exit non-zero so orchestration surfaces it.
bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
