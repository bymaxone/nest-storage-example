/**
 * @fileoverview Root controller - a tiny service identity endpoint that proves
 * the application boots and routes requests before the feature modules land.
 * @layer api/controllers
 */
import { Controller, Get } from '@nestjs/common'

/** Human-readable service name surfaced at the root route. */
const SERVICE_NAME = 'nest-storage-example'
/** Reported API version - the reference app is unversioned pre-release. */
const SERVICE_VERSION = '0.0.0'
/** Where a consumer finds the API surface documentation. */
const DOCS_PATH = '/system/recipes'

/** Shape returned by the root identity route. */
export interface ServiceIdentity {
  name: string
  version: string
  docs: string
}

/** Root identity surface. No Swagger - JSDoc documents the route. */
@Controller()
export class AppController {
  /**
   * GET / - returns the service identity so a probe can confirm the app is up
   * and pointed at its documentation surface.
   *
   * @returns The service name, version, and docs pointer.
   */
  @Get()
  root(): ServiceIdentity {
    return { name: SERVICE_NAME, version: SERVICE_VERSION, docs: DOCS_PATH }
  }
}
