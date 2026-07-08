/**
 * Unit: ValidationLabController - thin delegation to the service.
 *
 * Constructs the controller with a mocked service. Covers the upload delegation,
 * the missing-file guard (400), and the rules delegation.
 *
 * @module validation-lab/validation-lab.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { ValidationLabController } from './validation-lab.controller.js'
import type {
  MulterFile,
  ValidationLabService,
  ValidationRulesView,
  ValidationUploadResult,
} from './validation-lab.service.js'

/** A multer in-memory file stub. */
function makeFile(): MulterFile {
  return { originalname: 'a.png', mimetype: 'image/png', size: 8, buffer: Buffer.from('x') }
}

/** The rules view stub returned by the mocked service. */
const rules: ValidationRulesView = {
  mimeWhitelist: ['image/png'],
  maxSizeBytes: 4096,
  customValidators: ['pdf-magic-byte'],
}

/**
 * Builds the controller with a mocked service.
 *
 * @returns The controller and its mocked service functions.
 */
function setup() {
  const upload = jest.fn<ValidationLabService['upload']>()
  const rulesFn = jest.fn<ValidationLabService['rules']>().mockReturnValue(rules)
  const service = { upload, rules: rulesFn } as unknown as ValidationLabService
  const controller = new ValidationLabController(service)
  return { controller, upload, rulesFn }
}

describe('ValidationLabController (unit)', () => {
  it('delegates a present file to the service', async () => {
    /*
     * Scenario: a file part is present in the request.
     * Rule it protects: the controller forwards it to the service unchanged.
     */
    const { controller, upload } = setup()
    const result: ValidationUploadResult = {
      result: {
        key: 'k',
        bucket: 'vault',
        etag: '"e"',
        contentType: 'image/png',
        publicUrl: 'u',
        multipart: false,
        fromIdempotencyCache: false,
      },
      rules,
    }
    upload.mockResolvedValue(result)
    await expect(controller.upload(makeFile())).resolves.toBe(result)
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('rejects a request with no file part', async () => {
    /*
     * Scenario: the multipart request carries no file.
     * Rule it protects: a missing file is a 400 bad request, never forwarded.
     */
    const { controller, upload } = setup()
    // Both undefined and null are rejected: the guard tests each with its own `===`,
    // so exercising both operands kills a mutant that drops the null check.
    await expect(controller.upload(undefined as unknown as MulterFile)).rejects.toMatchObject({
      response: { error: { code: 'VALIDATION', message: 'file is required' } },
    })
    await expect(controller.upload(null as unknown as MulterFile)).rejects.toMatchObject({
      response: { error: { code: 'VALIDATION', message: 'file is required' } },
    })
    expect(upload).not.toHaveBeenCalled()
  })

  it('delegates the rules query to the service', () => {
    /*
     * Scenario: the rules endpoint is queried.
     * Rule it protects: the controller returns the service's rendered rules verbatim.
     */
    const { controller, rulesFn } = setup()
    expect(controller.rules()).toBe(rules)
    expect(rulesFn).toHaveBeenCalledTimes(1)
  })
})
