/**
 * @fileoverview Compile-time resolution proof for `@bymax-one/nest-storage`.
 * The API consumes the library from BOTH published subpaths: the server entry
 * (`.`) for the module, services, injection tokens, no-op providers, and
 * recipes, and the shared entry (`./shared`) for error codes and constants.
 * Importing from both here and referencing every server-side symbol forces
 * `tsc` to fail loudly if the package `exports` map, the dual ESM/CJS build, or
 * the single-copy peer graph ever regresses. It also anchors the export-usage
 * audit (`scripts/audit-library-exports.mjs`): every server export is named
 * here or in a real wiring site, so an unreferenced export fails CI. The module
 * has no runtime side effects.
 * @layer Probe
 */
import {
  BYMAX_STORAGE_FILE_SCANNER,
  BYMAX_STORAGE_IDEMPOTENCY_CACHE,
  BYMAX_STORAGE_LOGGER,
  BYMAX_STORAGE_UPLOAD_VALIDATORS,
  BymaxStorageModule,
  NoOpFileScanner,
  NoOpUploadValidator,
  SignedUrlService,
  StorageService,
  providerRecipes,
  type BymaxStorageModuleAsyncOptions,
  type BymaxStorageModuleOptionsFactory,
  type DeleteManyOptions,
  type MultipartUploadUrlsOptions,
  type ProviderRecipe,
  type SignedGetUrlOptions,
  type SignedPutUrlOptions,
} from '@bymax-one/nest-storage'
import { DEFAULT_SIGNED_URL_TTL_SECONDS, STORAGE_ERROR_CODES } from '@bymax-one/nest-storage/shared'

/**
 * Names every runtime symbol imported from the two subpaths so the compiler
 * retains the imports and proves resolution. The injection tokens and the two
 * no-op providers are named alongside the module, services, and recipes so the
 * export-usage audit sees the whole server value surface. Nothing consumes this
 * at runtime beyond the probe's own unit test.
 */
export const nestStorageResolutionProbe = {
  serverModule: BymaxStorageModule,
  storageService: StorageService,
  signedUrlService: SignedUrlService,
  providerRecipes,
  storageErrorCodes: STORAGE_ERROR_CODES,
  defaultSignedUrlTtlSeconds: DEFAULT_SIGNED_URL_TTL_SECONDS,
  fileScannerToken: BYMAX_STORAGE_FILE_SCANNER,
  idempotencyCacheToken: BYMAX_STORAGE_IDEMPOTENCY_CACHE,
  loggerToken: BYMAX_STORAGE_LOGGER,
  uploadValidatorsToken: BYMAX_STORAGE_UPLOAD_VALIDATORS,
  noOpFileScanner: NoOpFileScanner,
  noOpUploadValidator: NoOpUploadValidator,
} as const

/**
 * Binds every server-side option/type export in a single type-only surface so
 * the compiler proves each one resolves from the server entry. Type-only, so it
 * carries no runtime cost and no coverage obligation, while still anchoring the
 * export-usage audit for the option contracts the app configures indirectly.
 */
export type StorageServerContracts = {
  asyncOptions: BymaxStorageModuleAsyncOptions
  optionsFactory: BymaxStorageModuleOptionsFactory
  deleteMany: DeleteManyOptions
  multipartUrls: MultipartUploadUrlsOptions
  providerRecipe: ProviderRecipe<unknown>
  signedGet: SignedGetUrlOptions
  signedPut: SignedPutUrlOptions
}
