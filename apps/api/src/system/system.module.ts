/**
 * @fileoverview The system module groups operational surfaces: the health probe
 * and (as it lands) the config-introspection and provider-recipe endpoints. The
 * storage library is global, so its `StorageService` and options token are
 * injectable here without an explicit import.
 * @layer api/system
 */
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller.js'
import { SystemController } from './system.controller.js'
import { QuirksController } from './quirks.controller.js'
import { QuirksService } from './quirks.service.js'
import { VersioningController } from './versioning.controller.js'
import { VersioningService } from './versioning.service.js'

/** Groups the operational (health + introspection + quirk + versioning) controllers. */
@Module({
  controllers: [HealthController, SystemController, QuirksController, VersioningController],
  providers: [QuirksService, VersioningService],
})
export class SystemModule {}
