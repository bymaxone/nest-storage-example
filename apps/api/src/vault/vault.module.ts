/**
 * @fileoverview Vault feature module. Wires the object-level controller
 * (`VaultController` at `vault/object`) and the collection-level browse
 * controller (`VaultBrowseController` at `vault`). `StorageService` is exported
 * globally by `BymaxStorageModule` and needs no explicit import here.
 * `ConfigModule` is global and provides `ConfigService`.
 * @layer api/vault
 */
import { Module } from '@nestjs/common'
import { VaultController } from './vault.controller.js'
import { VaultBrowseController } from './vault-browse.controller.js'
import { VaultService } from './vault.service.js'

/** Feature module for all `/vault/*` routes. */
@Module({
  controllers: [VaultController, VaultBrowseController],
  providers: [VaultService],
})
export class VaultModule {}
