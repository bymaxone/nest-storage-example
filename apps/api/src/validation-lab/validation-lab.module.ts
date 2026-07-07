/**
 * @fileoverview Validation-lab feature module. Registers `MulterModule` with
 * memory storage and a GENEROUS hard `fileSize` cap (well above the library size
 * gate) via `buildValidationLabMulterOptions`: the library's size validation is
 * the system under test, so a body just over `UPLOAD_MAX_SIZE_BYTES` must still
 * reach the library to be rejected with `STORAGE_SIZE_EXCEEDED` (413) rather than
 * being stopped early by multer, while the cap prevents an absurdly large upload
 * from exhausting memory before validation. `StorageService` and the resolved
 * options token are exported globally by `BymaxStorageModule`, so no library
 * import is needed here.
 * @layer api/validation-lab
 */
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MulterModule } from '@nestjs/platform-express'
import type { MulterModuleOptions } from '@nestjs/platform-express'
import { ConfigModule } from '../config/config.module.js'
import type { Env } from '../config/env.schema.js'
import { ValidationLabController } from './validation-lab.controller.js'
import { ValidationLabService } from './validation-lab.service.js'
import { buildValidationLabMulterOptions } from './validation-lab.multer.js'

/** Feature module for all `/validation/*` routes. */
@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<{ env: Env }, true>): MulterModuleOptions =>
        buildValidationLabMulterOptions(config.get('env', { infer: true })),
    }),
  ],
  controllers: [ValidationLabController],
  providers: [ValidationLabService],
})
export class ValidationLabModule {}
