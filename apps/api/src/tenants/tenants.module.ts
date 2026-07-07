/**
 * @fileoverview Tenants feature module. Wires the controller and service for the
 * tenant-scoped object surface. `StorageService` and the resolved options token
 * are exported globally by `BymaxStorageModule`, so no library import is needed
 * here. Tenant isolation is application-level prefix composition under the single
 * module `keyPrefix` (the service documents the honest design).
 * @layer api/tenants
 */
import { Module } from '@nestjs/common'
import { TenantsController } from './tenants.controller.js'
import { TenantsService } from './tenants.service.js'

/** Feature module for all `/tenants/:t/*` routes. */
@Module({
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
