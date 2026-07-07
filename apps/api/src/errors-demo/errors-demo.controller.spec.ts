/**
 * Unit: ErrorsDemoController - thin delegation to the service.
 *
 * Constructs the controller with a mocked service and covers the catalogue and
 * trigger delegations. Also imports the code param schema to assert an unknown
 * code is rejected.
 *
 * @module errors-demo/errors-demo.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { ErrorsDemoController } from './errors-demo.controller.js'
import type { ErrorsDemoService } from './errors-demo.service.js'
import type { CatalogueEntry } from './error-catalogue.js'
import { errorCodeParamSchema } from './dto/error-code.dto.js'

/**
 * Builds the controller with a mocked service.
 *
 * @returns The controller and its mocked service functions.
 */
function setup() {
  const catalogue = jest.fn<ErrorsDemoService['catalogue']>()
  const trigger = jest.fn<ErrorsDemoService['trigger']>()
  const service = { catalogue, trigger } as unknown as ErrorsDemoService
  const controller = new ErrorsDemoController(service)
  return { controller, catalogue, trigger }
}

describe('ErrorsDemoController (unit)', () => {
  it('delegates the catalogue query to the service', () => {
    /*
     * Scenario: the catalogue endpoint is queried.
     * Rule it protects: the controller returns the service catalogue verbatim.
     */
    const { controller, catalogue } = setup()
    const entries: CatalogueEntry[] = [
      { code: 'STORAGE_TIMEOUT', status: 504, message: 'm', trigger: 't', reproducible: true },
    ]
    catalogue.mockReturnValue(entries)
    expect(controller.catalogue()).toBe(entries)
  })

  it('delegates a trigger to the service', async () => {
    /*
     * Scenario: a code trigger is requested.
     * Rule it protects: the controller forwards the validated code to the service.
     */
    const { controller, trigger } = setup()
    trigger.mockResolvedValue(undefined)
    await controller.trigger('STORAGE_TIMEOUT')
    expect(trigger).toHaveBeenCalledWith('STORAGE_TIMEOUT')
  })

  it('rejects an unknown error code at the param schema', () => {
    /*
     * Scenario: an unknown code is submitted.
     * Rule it protects: only shipped STORAGE_ERROR_CODES values validate.
     */
    expect(errorCodeParamSchema.safeParse('STORAGE_NOT_A_CODE').success).toBe(false)
    expect(errorCodeParamSchema.safeParse('STORAGE_TIMEOUT').success).toBe(true)
  })
})
