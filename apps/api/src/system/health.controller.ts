/**
 * @fileoverview Health probe. `GET /health` runs a cheap `exists()` check
 * against a sentinel key in the default bucket and reports connectivity plus
 * round-trip latency (spec §19). A reachable provider yields `{ status: 'up' }`;
 * an unconfigured module or an unexpected fault yields `{ status: 'down' }` with
 * HTTP 503 so a load balancer can drain the instance.
 * @layer api/system
 */
import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common'
import { BYMAX_STORAGE_OPTIONS, StorageService } from '@bymax-one/nest-storage'
import type { BymaxStorageModuleOptions } from '@bymax-one/nest-storage'

/** Sentinel key probed for health; the library prepends the global key prefix. */
const HEALTH_SENTINEL_KEY = 'health/sentinel'

/** Structured health report returned by the probe. */
export interface HealthReport {
  status: 'up' | 'down'
  latencyMs: number
  bucket: string
}

/** Probe-safe health surface. No Swagger - JSDoc documents the route. */
@Controller()
export class HealthController {
  constructor(
    private readonly storage: StorageService,
    @Inject(BYMAX_STORAGE_OPTIONS) private readonly options: BymaxStorageModuleOptions,
  ) {}

  /**
   * GET /health - probes storage connectivity via a sentinel `exists()` call.
   *
   * @returns `{ status: 'up', latencyMs, bucket }` when the provider responds.
   * @throws ServiceUnavailableException `{ status: 'down', latencyMs, bucket }`
   *   (HTTP 503) when the probe throws (unconfigured module or fault).
   */
  @Get('health')
  async health(): Promise<HealthReport> {
    const start = Date.now()
    try {
      await this.storage.exists(HEALTH_SENTINEL_KEY)
      return { status: 'up', latencyMs: Date.now() - start, bucket: this.options.bucket }
    } catch {
      throw new ServiceUnavailableException({
        status: 'down',
        latencyMs: Date.now() - start,
        bucket: this.options.bucket,
      })
    }
  }
}
