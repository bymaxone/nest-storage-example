/**
 * @fileoverview Signed feature module. Wires the presigned-URL controller and
 * its two services, and binds the confirm-time scanner seam (`CONFIRM_SCANNER`)
 * to the real `ScannerConfirm`: a direct presigned PUT bypasses the pipeline, so
 * confirm downloads a bounded prefix of the landed object, scans it, and removes
 * it on an infected verdict. The `NoOpConfirmScanner` stays exported (from
 * `confirm-scanner.js`) as the documented fallback for tests and for deployments
 * with no scanner configured. `SignedUrlService`, `StorageService`, the resolved
 * options, and the raw S3 client token are all exported globally by
 * `BymaxStorageModule`, so no library import is needed here.
 * @layer api/signed
 */
import { Module } from '@nestjs/common'
import { StorageService } from '@bymax-one/nest-storage'
import { MarkerFileScanner } from '../scanner-lab/marker-file.scanner.js'
import { SignedController } from './signed.controller.js'
import { SignedService } from './signed.service.js'
import { ConfirmService } from './confirm.service.js'
import { CONFIRM_SCANNER } from './confirm-scanner.js'
import { ScannerConfirm } from './scanner-confirm.js'

/** Feature module for all `/signed/*` routes. */
@Module({
  controllers: [SignedController],
  providers: [
    SignedService,
    ConfirmService,
    // Confirm-time scanner: the real ScannerConfirm downloads a bounded prefix of
    // the landed object, runs the inert marker scanner, and deletes the object on
    // an infected verdict, so a direct upload is really inspected (spec §16).
    {
      provide: CONFIRM_SCANNER,
      useFactory: (storage: StorageService): ScannerConfirm =>
        new ScannerConfirm(storage, new MarkerFileScanner()),
      inject: [StorageService],
    },
  ],
})
export class SignedModule {}
