/**
 * Unit: HealthController - the sentinel-probe liveness surface.
 *
 * Constructs the controller directly with a mocked StorageService and options,
 * covering the up path (exists resolves), the down path (exists throws -> 503),
 * and the route metadata. Latency is pinned so a `+`/`-` mutant is caught.
 *
 * @module system/health.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { RequestMethod, ServiceUnavailableException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { BymaxStorageModuleOptions, StorageService } from '@bymax-one/nest-storage'
import { HealthController } from './health.controller.js'

/** NestJS route-metadata keys (mirror @nestjs/common/constants, which has no NodeNext type subpath). */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/**
 * Builds the controller with a controllable `exists` mock and a fixed bucket.
 *
 * @returns The controller plus the `exists` mock.
 */
function setup() {
  const exists = jest.fn<StorageService['exists']>()
  const storage = { exists } as unknown as StorageService
  const options = { bucket: 'vault' } as BymaxStorageModuleOptions
  return { controller: new HealthController(storage, options), exists }
}

describe('HealthController (unit)', () => {
  describe('health', () => {
    it('reports up with the bucket and measured latency when the probe resolves', async () => {
      /*
       * Scenario: the sentinel exists() call resolves (provider reachable).
       * Rule it protects: the up arm returns the bucket and a latency equal to the
       * exact time DIFFERENCE (a `+` mutant would report the sum).
       */
      const { controller, exists } = setup()
      exists.mockResolvedValue(false)
      jest.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(1_004)

      const report = await controller.health()

      expect(report).toEqual({ status: 'up', latencyMs: 4, bucket: 'vault' })
      // The probe targets the fixed sentinel key, not an empty or altered key.
      expect(exists).toHaveBeenCalledWith('health/sentinel')
    })

    it('throws a 503 down report when the probe rejects', async () => {
      /*
       * Scenario: exists() throws (unconfigured module or fault).
       * Rule it protects: the catch arm raises ServiceUnavailableException with a
       * down status, the bucket, and the measured latency.
       */
      const { controller, exists } = setup()
      exists.mockRejectedValue(new Error('unreachable'))
      jest.spyOn(Date, 'now').mockReturnValueOnce(2_000).mockReturnValueOnce(2_006)

      let thrown: unknown
      try {
        await controller.health()
      } catch (error) {
        thrown = error
      }

      expect(thrown).toBeInstanceOf(ServiceUnavailableException)
      expect((thrown as ServiceUnavailableException).getResponse()).toEqual({
        status: 'down',
        latencyMs: 6,
        bucket: 'vault',
      })
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('declares GET health for the health handler', () => {
      /*
       * Scenario: inspect the route's verb and sub-path.
       * Rule it protects: the GET verb and the literal `health` sub-path are pinned.
       */
      const handler: keyof HealthController = 'health'
      const fn = HealthController.prototype[handler]
      expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(RequestMethod.GET)
      expect(reflector.get<string>(PATH_METADATA, fn)).toBe('health')
    })
  })
})
