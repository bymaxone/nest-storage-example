/**
 * @fileoverview Error-explorer feature module. Wires the controller and service.
 * `StorageService`, `SignedUrlService`, and the resolved options token are
 * exported globally by `BymaxStorageModule`, and `ScopedStorageFactory` by the
 * global scoped-storage module, so no additional providers are declared here.
 * @layer api/errors-demo
 */
import { Module } from '@nestjs/common'
import { ErrorsDemoController } from './errors-demo.controller.js'
import { ErrorsDemoService } from './errors-demo.service.js'

/** Feature module for the `/errors` explorer. */
@Module({
  controllers: [ErrorsDemoController],
  providers: [ErrorsDemoService],
})
export class ErrorsDemoModule {}
