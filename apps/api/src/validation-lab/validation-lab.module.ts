/**
 * @fileoverview Validation-lab feature module. Registers `MulterModule` with
 * memory storage and DELIBERATELY no `fileSize` limit: the library's size
 * validation is the system under test, so an oversized body must reach the
 * library to be rejected with `STORAGE_SIZE_EXCEEDED` (413) rather than being
 * stopped early by multer. This is the opposite choice from the uploads module,
 * which caps multer at `UPLOAD_MAX_SIZE_BYTES`. `StorageService` and the resolved
 * options token are exported globally by `BymaxStorageModule`, so no library
 * import is needed here.
 * @layer api/validation-lab
 */
import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { ValidationLabController } from './validation-lab.controller.js'
import { ValidationLabService } from './validation-lab.service.js'

/** Feature module for all `/validation/*` routes. */
@Module({
  imports: [MulterModule.register({})],
  controllers: [ValidationLabController],
  providers: [ValidationLabService],
})
export class ValidationLabModule {}
