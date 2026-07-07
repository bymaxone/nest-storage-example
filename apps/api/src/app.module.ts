/**
 * @fileoverview Root application module. Assembles the validated configuration
 * layer, the canonical `BymaxStorageModule.forRootAsync` wiring, the
 * controllers, and the feature modules of the reference API.
 * @layer api/module
 */
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BymaxStorageModule } from '@bymax-one/nest-storage'
import type { BymaxStorageModuleOptions } from '@bymax-one/nest-storage'
import { ConfigModule } from './config/config.module.js'
import { buildStorageOptions } from './config/storage.config.js'
import { AppController } from './app.controller.js'
import { SystemModule } from './system/system.module.js'
import { UploadsModule } from './uploads/uploads.module.js'
import { VaultModule } from './vault/vault.module.js'
import { SignedModule } from './signed/signed.module.js'
import { ValidationLabModule } from './validation-lab/validation-lab.module.js'
import { ScannerLabModule } from './scanner-lab/scanner-lab.module.js'
import type { Env } from './config/env.schema.js'

/** Root module of the nest-storage-example API. */
@Module({
  imports: [
    ConfigModule,
    BymaxStorageModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // The shipped d.ts types async factory args as `unknown[]`, so the injected
      // ConfigService is narrowed here rather than annotated on the parameter
      // (reconciles spec §9.2 against the library declarations).
      useFactory: (injected: unknown): BymaxStorageModuleOptions => {
        const config = injected as ConfigService<{ env: Env }, true>
        return buildStorageOptions(config.get('env', { infer: true }))
      },
    }),
    SystemModule,
    UploadsModule,
    VaultModule,
    SignedModule,
    ValidationLabModule,
    ScannerLabModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
