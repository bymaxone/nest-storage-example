/**
 * @fileoverview Vault feature module. Wires the download controller and service.
 * `StorageService` is exported globally by `BymaxStorageModule` and needs no
 * explicit import here. `ConfigModule` is global and provides `ConfigService`.
 * @layer api/vault
 */
import { Module } from '@nestjs/common'
import { VaultController } from './vault.controller.js'
import { VaultService } from './vault.service.js'

/** Feature module for all `/vault/*` routes. */
@Module({
  controllers: [VaultController],
  providers: [VaultService],
})
export class VaultModule {}
