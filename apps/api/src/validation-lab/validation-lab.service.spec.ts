/**
 * Unit: ValidationLabService - drives the library validation pipeline.
 *
 * Mocks `StorageService.upload` directly. Covers the pass-through to upload with
 * the rendered rules, propagation of each library envelope (MIME 415, size 413,
 * custom-validator 400), and rules rendering from the resolved options token
 * including the no-validation-policy branch.
 *
 * @module validation-lab/validation-lab.service.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { StorageException } from '@bymax-one/nest-storage'
import type { StorageService, UploadResult, IUploadValidator } from '@bymax-one/nest-storage'
import {
  ValidationLabService,
  type MulterFile,
  type ValidationUploadResult,
} from './validation-lab.service.js'
import type { ValidationLabPolicyOptions } from './validation-policy.js'

/** A named custom validator stub (only `name` is read by the lab). */
function validatorNamed(name: string): IUploadValidator {
  return { name, validate: () => Promise.resolve({ ok: true }) }
}

/** Default options carrying a whitelist, size cap, and one custom validator. */
function makeOptions(
  overrides: Partial<ValidationLabPolicyOptions> = {},
): ValidationLabPolicyOptions {
  return {
    validation: {
      mimeWhitelist: ['image/png', 'video/*'],
      maxSizeBytes: 4096,
      customValidators: [validatorNamed('pdf-magic-byte')],
    },
    ...overrides,
  }
}

/** A multer in-memory file stub. */
function makeFile(overrides: Partial<MulterFile> = {}): MulterFile {
  return {
    originalname: 'sample.png',
    mimetype: 'image/png',
    size: 64,
    buffer: Buffer.from('data'),
    ...overrides,
  }
}

/** A minimal successful upload result. */
function makeUploadResult(): UploadResult {
  return {
    key: 'storage-example/validation-lab/uuid.png',
    bucket: 'vault',
    etag: '"abc"',
    contentType: 'image/png',
    publicUrl: 'http://localhost:9000/vault/storage-example/validation-lab/uuid.png',
    multipart: false,
    fromIdempotencyCache: false,
  }
}

/**
 * Builds the service with a mocked storage upload.
 *
 * @param options - Policy options exposed via the token.
 * @returns The service and its mocked upload function.
 */
function setup(options: ValidationLabPolicyOptions = makeOptions()) {
  const upload = jest.fn<StorageService['upload']>()
  const storage = { upload } as unknown as StorageService
  const service = new ValidationLabService(storage, options)
  return { service, upload }
}

describe('ValidationLabService (unit)', () => {
  it('uploads under a validation-lab key and returns the active rules', async () => {
    /*
     * Scenario: a whitelisted PNG within the size cap flows through the pipeline.
     * Rule it protects: the file is uploaded under a `validation-lab/` key with the
     * declared content type and true size, and the response names the active rules.
     */
    const { service, upload } = setup()
    upload.mockResolvedValue(makeUploadResult())
    const res: ValidationUploadResult = await service.upload(makeFile())
    expect(upload).toHaveBeenCalledTimes(1)
    const call = upload.mock.calls[0]?.[0]
    // The key is `validation-lab/<uuid><ext>`: only the uuid (hex + dashes) may
    // precede the extension. A mutant that appends the whole filename instead of
    // just its extension (leaking `sample`) fails this hex-only anchor.
    expect(call?.key).toMatch(/^validation-lab\/[0-9a-f-]+\.png$/)
    expect(call?.contentType).toBe('image/png')
    expect(call?.size).toBe(64)
    expect(res.rules).toEqual({
      mimeWhitelist: ['image/png', 'video/*'],
      maxSizeBytes: 4096,
      customValidators: ['pdf-magic-byte'],
    })
  })

  it('composes a key without an extension when the filename has none', async () => {
    /*
     * Scenario: an uploaded file whose name carries no dot.
     * Rule it protects: the key omits the extension rather than appending a stray dot.
     */
    const { service, upload } = setup()
    upload.mockResolvedValue(makeUploadResult())
    await service.upload(makeFile({ originalname: 'noext' }))
    expect(upload.mock.calls[0]?.[0]?.key).toMatch(/^validation-lab\/[0-9a-f-]+$/)
  })

  it('preserves a leading-dot extension (dotfile at index 0)', async () => {
    /*
     * Scenario: an uploaded file named like a dotfile (".env"), whose only dot is
     * at index 0.
     * Rule it protects: the extension boundary is inclusive of index 0, so the
     * dotfile suffix is preserved (kills a `>= 0` to `> 0` mutation that drops it).
     */
    const { service, upload } = setup()
    upload.mockResolvedValue(makeUploadResult())
    await service.upload(makeFile({ originalname: '.env' }))
    expect(upload.mock.calls[0]?.[0]?.key).toMatch(/^validation-lab\/[0-9a-f-]+\.env$/)
  })

  it('propagates the MIME envelope for a disallowed content type', async () => {
    /*
     * Scenario: the library rejects a content type outside the whitelist.
     * Rule it protects: the 415 STORAGE_MIME_NOT_ALLOWED envelope is not caught or rewritten.
     */
    const { service, upload } = setup()
    upload.mockRejectedValue(new StorageException('STORAGE_MIME_NOT_ALLOWED'))
    await expect(service.upload(makeFile({ mimetype: 'application/zip' }))).rejects.toMatchObject({
      code: 'STORAGE_MIME_NOT_ALLOWED',
    })
  })

  it('propagates the size envelope for an oversized body', async () => {
    /*
     * Scenario: the library rejects a body above the configured cap.
     * Rule it protects: the 413 STORAGE_SIZE_EXCEEDED envelope propagates untouched.
     */
    const { service, upload } = setup()
    upload.mockRejectedValue(new StorageException('STORAGE_SIZE_EXCEEDED'))
    await expect(service.upload(makeFile({ size: 999_999 }))).rejects.toMatchObject({
      code: 'STORAGE_SIZE_EXCEEDED',
    })
  })

  it('propagates the validation envelope for a failed custom validator', async () => {
    /*
     * Scenario: the library rejects a body that failed a custom validator.
     * Rule it protects: the 400 STORAGE_VALIDATION_FAILED envelope propagates untouched.
     */
    const { service, upload } = setup()
    upload.mockRejectedValue(new StorageException('STORAGE_VALIDATION_FAILED'))
    await expect(service.upload(makeFile({ mimetype: 'application/pdf' }))).rejects.toMatchObject({
      code: 'STORAGE_VALIDATION_FAILED',
    })
  })

  it('renders empty collections when no validation policy is configured', () => {
    /*
     * Scenario: the module carries no validation block at all.
     * Rule it protects: the rules render an empty whitelist and validator list with
     * no size cap, rather than throwing on the absent policy.
     */
    const { service } = setup({})
    expect(service.rules()).toEqual({ mimeWhitelist: [], customValidators: [] })
  })
})
