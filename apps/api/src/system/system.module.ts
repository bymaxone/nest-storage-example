/**
 * @fileoverview The system module groups operational surfaces: the health probe
 * and (as it lands) the config-introspection and provider-recipe endpoints. The
 * storage library is global, so its `StorageService` and options token are
 * injectable here without an explicit import.
 * @layer api/system
 */
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller.js'

/** Groups the operational (health + introspection) controllers. */
@Module({
  controllers: [HealthController],
})
export class SystemModule {}
