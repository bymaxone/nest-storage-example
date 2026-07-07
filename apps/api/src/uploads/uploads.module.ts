/**
 * @fileoverview Uploads feature module. Wires the controller, service, and
 * session store for all upload routes, and registers `MulterModule` with a
 * config-driven `fileSize` limit so every `FileInterceptor` shares the
 * `UPLOAD_MAX_SIZE_BYTES` ceiling. `StorageService` is exported globally by
 * `BymaxStorageModule` and needs no explicit import here.
 * @layer api/uploads
 */
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MulterModule } from '@nestjs/platform-express'
import type { MulterModuleOptions } from '@nestjs/platform-express'
import { ConfigModule } from '../config/config.module.js'
import type { Env } from '../config/env.schema.js'
import { UploadsController } from './uploads.controller.js'
import { UploadsService } from './uploads.service.js'
import { UploadSessionStore } from './upload-session.store.js'
import { buildMulterOptions } from './multer.config.js'

/** Feature module for all `/uploads/*` routes. */
@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<{ env: Env }, true>): MulterModuleOptions =>
        buildMulterOptions(config.get('env', { infer: true })),
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService, UploadSessionStore],
})
export class UploadsModule {}
