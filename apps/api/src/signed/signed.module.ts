/**
 * @fileoverview Signed feature module. Wires the presigned-URL controller and
 * its two services, and binds the confirm-time scanner seam (`CONFIRM_SCANNER`)
 * to the no-op default. `SignedUrlService`, `StorageService`, the resolved
 * options, and the raw S3 client token are all exported globally by
 * `BymaxStorageModule`, so no library import is needed here.
 * @layer api/signed
 */
import { Module } from '@nestjs/common'
import { SignedController } from './signed.controller.js'
import { SignedService } from './signed.service.js'
import { ConfirmService } from './confirm.service.js'
import { CONFIRM_SCANNER, NoOpConfirmScanner } from './confirm-scanner.js'

/** Feature module for all `/signed/*` routes. */
@Module({
  controllers: [SignedController],
  providers: [
    SignedService,
    ConfirmService,
    // Confirm-time scanner seam: the no-op default reports "skipped" so a direct
    // upload is never implicitly trusted. A real scanner replaces this binding
    // when scanner-verify is wired (spec §16).
    { provide: CONFIRM_SCANNER, useClass: NoOpConfirmScanner },
  ],
})
export class SignedModule {}
