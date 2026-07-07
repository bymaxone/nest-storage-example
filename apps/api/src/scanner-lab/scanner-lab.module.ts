/**
 * @fileoverview Scanner-lab feature module. Wires the controller, the service,
 * and a `MarkerFileScanner` provider. The provider is the SAME inert scanner
 * class the library runs (from the module options), used here only to classify
 * the submitted content so the verdict can be reflected into the object key and
 * narrated in the response; the library pipeline remains the enforcement
 * authority. `StorageService` and the resolved options token are exported
 * globally by `BymaxStorageModule`, so no library import is needed here.
 * @layer api/scanner-lab
 */
import { Module } from '@nestjs/common'
import { ScannerLabController } from './scanner-lab.controller.js'
import { ScannerLabService } from './scanner-lab.service.js'
import { MarkerFileScanner } from './marker-file.scanner.js'

/** Feature module for all `/scanner/*` routes. */
@Module({
  controllers: [ScannerLabController],
  providers: [
    ScannerLabService,
    // Provided by value (the plugin class carries no NestJS decorator): the lab
    // uses it to classify content, never to enforce the verdict.
    { provide: MarkerFileScanner, useValue: new MarkerFileScanner() },
  ],
})
export class ScannerLabModule {}
