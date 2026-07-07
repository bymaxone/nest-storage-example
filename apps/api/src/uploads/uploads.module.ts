/**
 * @fileoverview Uploads feature module. Wires the controller, service, and
 * session store for all upload routes. `StorageService` is exported globally
 * by `BymaxStorageModule` and needs no explicit import here.
 * @layer api/uploads
 */
import { Module } from '@nestjs/common'
import { UploadsController } from './uploads.controller.js'
import { UploadsService } from './uploads.service.js'
import { UploadSessionStore } from './upload-session.store.js'

/** Feature module for all `/uploads/*` routes. */
@Module({
  controllers: [UploadsController],
  providers: [UploadsService, UploadSessionStore],
})
export class UploadsModule {}
