/**
 * @fileoverview Raw-client versioning endpoint. Thin controller delegating to
 * `VersioningService`: `GET /system/versioning` reports per-bucket versioning
 * status via the injected raw `S3Client`, carrying the abstraction-loss trade-off
 * note (spec §11.1).
 * @layer api/system
 */
import { Controller, Get } from '@nestjs/common'
import { VersioningService, type VersioningView } from './versioning.service.js'

/** Advanced raw-client operations: the `/system/versioning` route. */
@Controller('system')
export class VersioningController {
  constructor(private readonly service: VersioningService) {}

  /**
   * GET /system/versioning - report per-bucket versioning status via the raw client.
   *
   * @returns The per-bucket versioning status and the abstraction-loss trade-off note.
   */
  @Get('versioning')
  versioning(): Promise<VersioningView> {
    return this.service.versioningStatus()
  }
}
