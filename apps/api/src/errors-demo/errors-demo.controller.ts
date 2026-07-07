/**
 * @fileoverview Error-explorer endpoints. Thin controller: `GET /errors` renders
 * the exhaustive catalogue; `POST /errors/:code` validates the code against the
 * shipped `STORAGE_ERROR_CODES` and runs its deterministic trigger. A reproducible
 * code throws its real `StorageException`, which the global filter renders with the
 * library's own status and envelope; the two non-reproducible codes
 * (`STORAGE_PART_TOO_SMALL` and `STORAGE_TIMEOUT`) return an honest 200
 * explanation (spec §18).
 * @layer api/errors-demo
 */
import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import type { StorageErrorCode } from '@bymax-one/nest-storage'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { ErrorsDemoService } from './errors-demo.service.js'
import type { CatalogueEntry } from './error-catalogue.js'
import type { TriggerOutcome } from './trigger.registry.js'
import { errorCodeParamSchema } from './dto/error-code.dto.js'

/** Error explorer: the `/errors` catalogue and per-code triggers. */
@Controller('errors')
export class ErrorsDemoController {
  constructor(private readonly service: ErrorsDemoService) {}

  /**
   * GET /errors - render the exhaustive error-code catalogue.
   *
   * @returns Every shipped code with its status, message, trigger, and reproducibility.
   */
  @Get()
  catalogue(): CatalogueEntry[] {
    return this.service.catalogue()
  }

  /**
   * POST /errors/:code - reproduce one error code through the real library.
   *
   * @param code - The validated storage error code.
   * @returns The honest outcome for a non-reproducible code; otherwise the real
   *   `StorageException` propagates to the global filter with its own status.
   */
  @Post(':code')
  @HttpCode(200)
  trigger(
    @Param('code', new ZodValidationPipe(errorCodeParamSchema)) code: StorageErrorCode,
  ): Promise<TriggerOutcome | void> {
    return this.service.trigger(code)
  }
}
