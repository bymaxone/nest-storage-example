/**
 * @fileoverview Compile-time resolution proof for `@bymax-one/nest-storage`.
 * The API consumes the library from BOTH published subpaths: the server entry
 * (`.`) for the module, services, and recipes, and the shared entry
 * (`./shared`) for error codes and constants. Importing from both here and
 * referencing every symbol forces `tsc` to fail loudly if the package
 * `exports` map, the dual ESM/CJS build, or the single-copy peer graph ever
 * regresses. The module has no runtime side effects.
 * @layer Probe
 */
import {
  BymaxStorageModule,
  SignedUrlService,
  StorageService,
  providerRecipes,
} from '@bymax-one/nest-storage'
import { DEFAULT_SIGNED_URL_TTL_SECONDS, STORAGE_ERROR_CODES } from '@bymax-one/nest-storage/shared'

/**
 * Names every symbol imported from the two subpaths so the compiler retains
 * the imports and proves resolution. Nothing consumes this at runtime.
 */
export const nestStorageResolutionProbe = {
  serverModule: BymaxStorageModule,
  storageService: StorageService,
  signedUrlService: SignedUrlService,
  providerRecipes,
  storageErrorCodes: STORAGE_ERROR_CODES,
  defaultSignedUrlTtlSeconds: DEFAULT_SIGNED_URL_TTL_SECONDS,
} as const
