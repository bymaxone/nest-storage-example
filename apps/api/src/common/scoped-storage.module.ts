/**
 * @fileoverview Global module exposing the `ScopedStorageFactory` so any feature
 * (the error explorer, the provider-quirk demos) can build auxiliary
 * misconfigured storage instances without re-wiring the factory each time.
 * @layer api/common
 */
import { Global, Module } from '@nestjs/common'
import { ScopedStorageFactory } from './scoped-storage.factory.js'

/** Provides and exports the scoped-storage factory application-wide. */
@Global()
@Module({
  providers: [ScopedStorageFactory],
  exports: [ScopedStorageFactory],
})
export class ScopedStorageModule {}
