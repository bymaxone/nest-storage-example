/**
 * @fileoverview Global configuration module. Wraps `@nestjs/config` with the
 * `loadEnv` factory so the Zod-validated environment is registered once, under
 * the `env` namespace, and injectable app-wide via `ConfigService<{ env: Env }>`.
 * Registering the loader (rather than a bare `validate`) exposes the whole typed
 * `Env` object that the canonical storage wiring consumes as `config.get('env')`.
 * @layer api/config
 */
import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { loadEnv } from './env.schema.js'

/** Registers the validated environment globally for the whole application. */
@Module({
  imports: [NestConfigModule.forRoot({ isGlobal: true, load: [loadEnv] })],
  exports: [NestConfigModule],
})
export class ConfigModule {}
