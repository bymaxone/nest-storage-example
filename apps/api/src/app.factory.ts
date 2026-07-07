/**
 * @fileoverview Application construction seam. `createApp()` builds and
 * configures the Nest application without listening on a port, so both the
 * process entrypoint (`main.ts`) and the e2e suite share one honest bootstrap
 * path. Keeping construction here means tests never spawn a child process to
 * exercise the wiring.
 * @layer api/bootstrap
 */
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import { AppModule } from './app.module.js'

/**
 * Origin allowed for browser (CORS) requests until the validated configuration
 * layer supplies `WEB_ORIGIN`. The bootstrap resolves the real value from the
 * config service once it is wired.
 */
const DEFAULT_WEB_ORIGIN = 'http://localhost:3000'

/**
 * Builds the configured Nest application: CORS for the dashboard origin and
 * graceful shutdown hooks. Does NOT call `listen()` — the caller owns the port.
 *
 * @returns The constructed, not-yet-listening application instance.
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.enableCors({ origin: DEFAULT_WEB_ORIGIN, credentials: true })
  app.enableShutdownHooks()
  return app
}
