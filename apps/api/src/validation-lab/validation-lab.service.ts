/**
 * @fileoverview Validation-lab service. Pushes an uploaded file straight into
 * the library's `StorageService.upload` under `validation-lab/` keys with NO
 * app-side prechecks, so the library's validation pipeline (MIME whitelist, size
 * cap, then the custom `IUploadValidator` chain) is the one that accepts or
 * rejects the request. Every rejection surfaces as the library's own
 * `StorageException` envelope through the global filter (415/413/400). The
 * service also renders the ACTIVE rules from the resolved options token so the
 * UI and the module can never disagree about what the pipeline enforces
 * (spec §16).
 * @layer api/validation-lab
 */
import { Inject, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
// StorageService must be a value import (not `import type`): NestJS resolves the
// constructor dependency from the emitted `design:paramtypes` metadata, which
// requires the class to exist at runtime. A type-only import is elided and DI fails.
import { BYMAX_STORAGE_OPTIONS, StorageService } from '@bymax-one/nest-storage'
import type { UploadResult } from '@bymax-one/nest-storage'
import type { ValidationLabPolicyOptions } from './validation-policy.js'

/** File as injected by multer memory storage. */
export interface MulterFile {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

/** The active validation rules, rendered from the resolved options token. */
export interface ValidationRulesView {
  /** MIME whitelist the pipeline enforces (exact or `type/*` wildcard entries). */
  mimeWhitelist: readonly string[]
  /** Maximum accepted size in bytes; absent when no size cap is configured. */
  maxSizeBytes?: number
  /** Names of the custom validators in the order the pipeline runs them. */
  customValidators: readonly string[]
}

/** Outcome of a validation-lab upload: the library result plus the active rules. */
export interface ValidationUploadResult {
  /** The library upload result for a body that passed the whole pipeline. */
  result: UploadResult
  /** The rules the pipeline applied, so the pass response names the validators that ran. */
  rules: ValidationRulesView
}

/**
 * Derives the file extension from the original filename, including the leading
 * dot. Returns an empty string when the name carries no extension.
 *
 * @param originalname - The original filename from the uploaded file.
 * @returns The extension including the dot, or `''` when absent.
 */
function extractExtension(originalname: string): string {
  const dotIndex = originalname.lastIndexOf('.')
  return dotIndex >= 0 ? originalname.slice(dotIndex) : ''
}

/** Drives the library validation pipeline and reports the rules it enforces. */
@Injectable()
export class ValidationLabService {
  constructor(
    private readonly storage: StorageService,
    @Inject(BYMAX_STORAGE_OPTIONS) private readonly options: ValidationLabPolicyOptions,
  ) {}

  /**
   * Uploads a file through the real library pipeline. The declared content type
   * and the true byte size are forwarded verbatim, so the MIME whitelist, the
   * size cap, and the custom validators decide the outcome; a rejection
   * propagates as the library's own envelope (415/413/400).
   *
   * @param file - The multer in-memory file.
   * @returns The upload result and the active rules that accepted it.
   * @throws {StorageException} Propagates the library envelope on any pipeline rejection.
   */
  async upload(file: MulterFile): Promise<ValidationUploadResult> {
    const key = `validation-lab/${randomUUID()}${extractExtension(file.originalname)}`
    const result = await this.storage.upload({
      key,
      body: file.buffer,
      contentType: file.mimetype,
      size: file.size,
    })
    return { result, rules: this.rules() }
  }

  /**
   * Renders the active validation rules from the resolved options token so the
   * response reflects exactly what the module runs with, never a re-declared
   * literal. An absent whitelist or validator list renders as an empty array.
   *
   * @returns The active whitelist, size cap, and custom-validator names.
   */
  rules(): ValidationRulesView {
    const validation = this.options.validation
    const maxSizeBytes = validation?.maxSizeBytes
    return {
      mimeWhitelist: validation?.mimeWhitelist ?? [],
      ...(maxSizeBytes !== undefined ? { maxSizeBytes } : {}),
      customValidators: (validation?.customValidators ?? []).map((validator) => validator.name),
    }
  }
}
