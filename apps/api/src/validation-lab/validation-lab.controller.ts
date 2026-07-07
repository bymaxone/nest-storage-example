/**
 * @fileoverview Validation-lab endpoints. Thin controller: it buffers a file
 * with multer memory storage and hands it, unchecked, to the service so the
 * library pipeline is the system under test. `POST /validation/upload` returns
 * the library result on a pass and the documented envelope (415/413/400) on a
 * rejection; `GET /validation/rules` renders the active whitelist, size cap, and
 * custom-validator names from the resolved options (spec §16, §18).
 * @layer api/validation-lab
 */
import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ValidationLabService,
  type MulterFile,
  type ValidationRulesView,
  type ValidationUploadResult,
} from './validation-lab.service.js'

/** Validation pipeline laboratory: all `/validation/*` routes. */
@Controller('validation')
export class ValidationLabController {
  constructor(private readonly service: ValidationLabService) {}

  /**
   * POST /validation/upload - drive a file through the real validation pipeline.
   *
   * No app-side prechecks run: the library rejects a disallowed MIME (415), an
   * oversized body (413), or a failed custom validator (400), each rendered as
   * its own envelope by the global filter. A body that passes every stage
   * returns the upload result alongside the rules that accepted it.
   *
   * @param file - The uploaded file from multer memory storage.
   * @returns The library upload result and the active rules.
   * @throws {BadRequestException} When no file part is present in the request.
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(201)
  async upload(@UploadedFile() file: MulterFile): Promise<ValidationUploadResult> {
    if (file === undefined || file === null) {
      throw new BadRequestException({ error: { code: 'VALIDATION', message: 'file is required' } })
    }
    return this.service.upload(file)
  }

  /**
   * GET /validation/rules - render the active validation rules.
   *
   * Reads the resolved options token so the UI and the module can never
   * disagree: the whitelist, the size cap, and the custom-validator names are
   * exactly what the pipeline enforces.
   *
   * @returns The active whitelist, size cap, and validator names.
   */
  @Get('rules')
  rules(): ValidationRulesView {
    return this.service.rules()
  }
}
