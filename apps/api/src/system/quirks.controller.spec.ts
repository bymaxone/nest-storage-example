/**
 * Unit: QuirksController - thin delegation to the service.
 *
 * Constructs the controller with a mocked service and covers the checksum-demo,
 * acl, and network delegations.
 *
 * @module system/quirks.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { QuirksController } from './quirks.controller.js'
import type {
  AclGuidanceView,
  ChecksumDemoView,
  NetworkKnobsView,
  QuirksService,
} from './quirks.service.js'

/**
 * Builds the controller with a mocked service.
 *
 * @returns The controller and its mocked service functions.
 */
function setup() {
  const checksumDemo = jest.fn<QuirksService['checksumDemo']>()
  const aclGuidance = jest.fn<QuirksService['aclGuidance']>()
  const networkKnobs = jest.fn<QuirksService['networkKnobs']>()
  const service = { checksumDemo, aclGuidance, networkKnobs } as unknown as QuirksService
  const controller = new QuirksController(service)
  return { controller, checksumDemo, aclGuidance, networkKnobs }
}

describe('QuirksController (unit)', () => {
  it('delegates the checksum demo to the service', async () => {
    /*
     * Scenario: the checksum demo is requested.
     * Rule it protects: the controller returns the service result verbatim.
     */
    const { controller, checksumDemo } = setup()
    const view = { diverged: true } as ChecksumDemoView
    checksumDemo.mockResolvedValue(view)
    await expect(controller.checksumDemo()).resolves.toBe(view)
  })

  it('delegates the ACL card to the service', () => {
    /*
     * Scenario: the ACL card is requested.
     * Rule it protects: the controller returns the service card verbatim.
     */
    const { controller, aclGuidance } = setup()
    const card = { mappedErrorCode: 'STORAGE_PROVIDER_ERROR' } as AclGuidanceView
    aclGuidance.mockReturnValue(card)
    expect(controller.acl()).toBe(card)
  })

  it('delegates the network card to the service', () => {
    /*
     * Scenario: the network card is requested.
     * Rule it protects: the controller returns the service card verbatim.
     */
    const { controller, networkKnobs } = setup()
    const card = { maxAttempts: 3, retries: 2 } as NetworkKnobsView
    networkKnobs.mockReturnValue(card)
    expect(controller.network()).toBe(card)
  })
})
