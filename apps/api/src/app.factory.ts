/**
 * @fileoverview Application construction seam. `createApp()` builds and
 * configures the Nest application without listening on a port, so both the
 * process entrypoint (`main.ts`) and the e2e suite share one honest bootstrap
 * path. Keeping construction here means tests never spawn a child process to
 * exercise the wiring. CORS origin is resolved from the validated configuration
 * (`WEB_ORIGIN`), never from a raw process lookup.
 * @layer api/bootstrap
 */
import { NestFactory } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import type { INestApplication } from '@nestjs/common'
import { AppModule } from './app.module.js'
import type { Env } from './config/env.schema.js'

/**
 * Builds the configured Nest application: CORS for the validated dashboard
 * origin and graceful shutdown hooks. Does NOT call `listen()` - the caller
 * owns the port.
 *
 * @returns The constructed, not-yet-listening application instance.
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const config = app.get<ConfigService<{ env: Env }, true>>(ConfigService)
  const env = config.get('env', { infer: true })
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true })
  app.enableShutdownHooks()
  return app
}
