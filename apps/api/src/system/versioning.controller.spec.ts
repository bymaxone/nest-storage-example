/**
 * Unit: VersioningController - thin delegation to the service.
 *
 * Constructs the controller with a mocked service and covers the versioning
 * delegation.
 *
 * @module system/versioning.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { VersioningController } from './versioning.controller.js'
import type { VersioningService, VersioningView } from './versioning.service.js'

describe('VersioningController (unit)', () => {
  it('delegates the versioning query to the service', async () => {
    /*
     * Scenario: the versioning endpoint is queried.
     * Rule it protects: the controller returns the service view verbatim.
     */
    const versioningStatus = jest.fn<VersioningService['versioningStatus']>()
    const service = { versioningStatus } as unknown as VersioningService
    const controller = new VersioningController(service)
    const view: VersioningView = {
      buckets: [{ bucket: 'vault', status: 'Unversioned' }],
      tradeOffNote: 'note',
    }
    versioningStatus.mockResolvedValue(view)
    await expect(controller.versioning()).resolves.toBe(view)
  })
})
