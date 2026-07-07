/**
 * @fileoverview Error-explorer service. Owns the deterministic trigger registry
 * and the exhaustive catalogue. `trigger()` runs a code's real library call so
 * the untouched envelope flows to the global filter (or returns the honest
 * outcome for the defined-but-unthrown codes `STORAGE_PART_TOO_SMALL` and
 * `STORAGE_TIMEOUT`); `catalogue()` renders every
 * shipped code with its library-mapped status, message, and trigger recipe.
 * @layer api/errors-demo
 */
import { Inject, Injectable } from '@nestjs/common'
// Value imports: the facades are injected as constructor dependencies and must
// exist at runtime for Nest to resolve `design:paramtypes` metadata.
import { BYMAX_STORAGE_OPTIONS, SignedUrlService, StorageService } from '@bymax-one/nest-storage'
import type { StorageErrorCode } from '@bymax-one/nest-storage'
import { ScopedStorageFactory } from '../common/scoped-storage.factory.js'
import { buildCatalogue, type CatalogueEntry } from './error-catalogue.js'
import { buildTriggerRegistry, type Trigger, type TriggerOutcome } from './trigger.registry.js'

/** Narrow view of the resolved options the triggers need (connection facts). */
export interface ErrorsConnectionOptions {
  endpoint: string
  region: string
  bucket: string
}

/** Drives the error-code triggers and renders the catalogue. */
@Injectable()
export class ErrorsDemoService {
  private readonly registry: Record<StorageErrorCode, Trigger>

  constructor(
    storage: StorageService,
    signedUrls: SignedUrlService,
    scoped: ScopedStorageFactory,
    @Inject(BYMAX_STORAGE_OPTIONS) options: ErrorsConnectionOptions,
  ) {
    this.registry = buildTriggerRegistry({
      storage,
      signedUrls,
      scoped,
      connection: { endpoint: options.endpoint, region: options.region, bucket: options.bucket },
    })
  }

  /**
   * Renders the exhaustive catalogue of every shipped error code with its
   * library-mapped HTTP status, default message, trigger recipe, and whether the
   * code is reproducible on demand.
   *
   * @returns One catalogue entry per shipped error code.
   */
  catalogue(): CatalogueEntry[] {
    return buildCatalogue()
  }

  /**
   * Reproduces one error code. A reproducible code throws its real
   * `StorageException` (relayed by the global filter); the defined-but-unthrown
   * codes (`STORAGE_PART_TOO_SMALL` and `STORAGE_TIMEOUT`) resolve to an
   * explanatory outcome.
   *
   * @param code - The validated storage error code.
   * @returns The explanatory outcome for a non-reproducible code; otherwise throws.
   * @throws {StorageException} The real, untouched exception for a reproducible code.
   */
  trigger(code: StorageErrorCode): Promise<TriggerOutcome | void> {
    return this.registry[code]()
  }
}
