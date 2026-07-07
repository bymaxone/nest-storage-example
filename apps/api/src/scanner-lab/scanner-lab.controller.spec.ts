/**
 * Unit: ScannerLabController - thin delegation to the service.
 *
 * Constructs the controller with a mocked service and covers the upload, exists,
 * and config delegations.
 *
 * @module scanner-lab/scanner-lab.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { ScannerLabController } from './scanner-lab.controller.js'
import type {
  ScannerConfigView,
  ScannerExistsResult,
  ScannerLabService,
  ScannerUploadResult,
} from './scanner-lab.service.js'

/**
 * Builds the controller with a mocked service.
 *
 * @returns The controller and its mocked service functions.
 */
function setup() {
  const upload = jest.fn<ScannerLabService['upload']>()
  const exists = jest.fn<ScannerLabService['exists']>()
  const config = jest.fn<ScannerLabService['config']>()
  const service = { upload, exists, config } as unknown as ScannerLabService
  const controller = new ScannerLabController(service)
  return { controller, upload, exists, config }
}

describe('ScannerLabController (unit)', () => {
  it('delegates an upload to the service', async () => {
    /*
     * Scenario: a scan-upload request arrives.
     * Rule it protects: the controller forwards the validated body to the service.
     */
    const { controller, upload } = setup()
    const result: ScannerUploadResult = {
      result: {
        key: 'k',
        bucket: 'vault',
        etag: '"e"',
        contentType: 'text/plain',
        publicUrl: 'u',
        multipart: false,
        fromIdempotencyCache: false,
      },
      key: 'scanner-lab/k',
      verdict: { status: 'clean', engine: 'marker-demo' },
    }
    upload.mockResolvedValue(result)
    await expect(controller.upload({ content: 'x' })).resolves.toBe(result)
    expect(upload).toHaveBeenCalledWith({ content: 'x' })
  })

  it('delegates an existence probe to the service', async () => {
    /*
     * Scenario: a removal-proof probe arrives.
     * Rule it protects: the controller forwards the key and returns the result.
     */
    const { controller, exists } = setup()
    const result: ScannerExistsResult = { key: 'scanner-lab/gone', exists: false }
    exists.mockResolvedValue(result)
    await expect(controller.exists({ key: 'scanner-lab/gone' })).resolves.toBe(result)
    expect(exists).toHaveBeenCalledWith('scanner-lab/gone')
  })

  it('delegates the config query to the service', () => {
    /*
     * Scenario: the config endpoint is queried.
     * Rule it protects: the controller returns the service's rendered config verbatim.
     */
    const { controller, config } = setup()
    const view: ScannerConfigView = { enabled: true, mode: 'pre-upload', rejectOnUnknown: false }
    config.mockReturnValue(view)
    expect(controller.config()).toBe(view)
  })
})
