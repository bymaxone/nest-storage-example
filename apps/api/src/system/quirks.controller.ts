/**
 * @fileoverview Provider-quirk endpoints. Thin controller delegating to
 * `QuirksService`: `POST /system/quirks/checksum-demo` runs the side-by-side
 * checksum comparison, `GET /system/quirks/acl` renders the ACL honesty card, and
 * `GET /system/quirks/network` renders the retry/timeout knobs (spec §12.6-§12.8).
 * @layer api/system
 */
import { Controller, Get, HttpCode, Post } from '@nestjs/common'
import {
  QuirksService,
  type AclGuidanceView,
  type ChecksumDemoView,
  type NetworkKnobsView,
} from './quirks.service.js'

/** Provider-quirk demonstrations: all `/system/quirks/*` routes. */
@Controller('system/quirks')
export class QuirksController {
  constructor(private readonly service: QuirksService) {}

  /**
   * POST /system/quirks/checksum-demo - compare WHEN_SUPPORTED vs WHEN_REQUIRED.
   *
   * @returns Both mode outcomes side by side, whether they diverged, and guidance.
   */
  @Post('checksum-demo')
  @HttpCode(200)
  checksumDemo(): Promise<ChecksumDemoView> {
    return this.service.checksumDemo()
  }

  /**
   * GET /system/quirks/acl - render the ACL honesty card.
   *
   * @returns The documented ACL behavior, mapped error code, and alternatives.
   */
  @Get('acl')
  acl(): AclGuidanceView {
    return this.service.aclGuidance()
  }

  /**
   * GET /system/quirks/network - render the retry/timeout knobs.
   *
   * @returns The resolved maxAttempts/requestTimeoutMs with the attempts-vs-retries note.
   */
  @Get('network')
  network(): NetworkKnobsView {
    return this.service.networkKnobs()
  }
}
