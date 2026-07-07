/**
 * Unit: ScannerLabService - drives the library scanner pipeline.
 *
 * Uses a real `MarkerFileScanner` (deterministic, inert) for the diagnostic
 * verdict and mocks `StorageService.upload`/`exists`. Covers the clean upload,
 * the accepted-unknown warning, marker reflection into the key, propagation of
 * the infected/inconclusive envelopes, the existence probe, and config rendering
 * across the enabled, defaulted, and disabled branches.
 *
 * @module scanner-lab/scanner-lab.service.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { StorageException } from '@bymax-one/nest-storage'
import type { StorageService, UploadResult } from '@bymax-one/nest-storage'
import { ScannerLabService } from './scanner-lab.service.js'
import { MarkerFileScanner } from './marker-file.scanner.js'
import type { ScannerLabPolicyOptions } from './scanner-policy.js'

/** A minimal successful upload result. */
function makeUploadResult(key: string): UploadResult {
  return {
    key: `storage-example/${key}`,
    bucket: 'vault',
    etag: '"abc"',
    contentType: 'text/plain',
    publicUrl: `http://localhost:9000/vault/storage-example/${key}`,
    multipart: false,
    fromIdempotencyCache: false,
  }
}

/**
 * Builds the service with a real marker scanner and mocked storage.
 *
 * @param options - Policy options exposed via the token.
 * @returns The service and its mocked storage functions.
 */
function setup(options: ScannerLabPolicyOptions = { scanner: { mode: 'pre-upload' } }) {
  const upload = jest.fn<StorageService['upload']>()
  const exists = jest.fn<StorageService['exists']>()
  const storage = { upload, exists } as unknown as StorageService
  const service = new ScannerLabService(storage, new MarkerFileScanner(), options)
  return { service, upload, exists }
}

describe('ScannerLabService (unit)', () => {
  it('uploads clean content under a plain key with a clean verdict', async () => {
    /*
     * Scenario: content with no marker is submitted.
     * Rule it protects: the verdict is clean, the key carries no marker label, and
     * no warning is attached.
     */
    const { service, upload } = setup()
    upload.mockImplementation((options) => Promise.resolve(makeUploadResult(options.key)))
    const res = await service.upload({ content: 'harmless text', keySeed: 'seed1' })
    expect(res.verdict.status).toBe('clean')
    expect(res.key).toBe('scanner-lab/seed1')
    expect(res.warning).toBeUndefined()
  })

  it('reflects the unknown marker into the key and attaches a warning', async () => {
    /*
     * Scenario: content carries X-DEMO-UNKNOWN and rejectOnUnknown is off.
     * Rule it protects: the library accepts it, the key carries the unknown marker
     * (so post-upload mode can see it), and the response warns about the acceptance.
     */
    const { service, upload } = setup()
    upload.mockImplementation((options) => Promise.resolve(makeUploadResult(options.key)))
    const res = await service.upload({ content: 'payload X-DEMO-UNKNOWN here', keySeed: 'seed2' })
    expect(res.verdict.status).toBe('unknown')
    expect(res.key).toBe('scanner-lab/X-DEMO-UNKNOWN--seed2')
    expect(res.warning).toContain('inconclusive')
  })

  it('reflects the infected marker into the key it uploads under', async () => {
    /*
     * Scenario: content carries X-DEMO-INFECTED (library configured not to throw here).
     * Rule it protects: the composed key embeds the infected marker so post-upload
     * mode (which scans the key) sees the same marker the body carries.
     */
    const { service, upload } = setup()
    upload.mockImplementation((options) => Promise.resolve(makeUploadResult(options.key)))
    await service.upload({ content: 'X-DEMO-INFECTED sample', keySeed: 'seed3' })
    expect(upload.mock.calls[0]?.[0]?.key).toBe('scanner-lab/X-DEMO-INFECTED--seed3')
  })

  it('generates a random key when no seed is supplied', async () => {
    /*
     * Scenario: clean content without a key seed.
     * Rule it protects: the key falls back to a random uuid under scanner-lab/.
     */
    const { service, upload } = setup()
    upload.mockImplementation((options) => Promise.resolve(makeUploadResult(options.key)))
    const res = await service.upload({ content: 'plain' })
    expect(res.key).toMatch(/^scanner-lab\/[0-9a-f-]+$/)
  })

  it('propagates the infected envelope from the library', async () => {
    /*
     * Scenario: the library rejects an infected body.
     * Rule it protects: the 422 STORAGE_SCAN_INFECTED envelope propagates untouched.
     */
    const { service, upload } = setup()
    upload.mockRejectedValue(new StorageException('STORAGE_SCAN_INFECTED'))
    await expect(
      service.upload({ content: 'X-DEMO-INFECTED', keySeed: 'x' }),
    ).rejects.toMatchObject({ code: 'STORAGE_SCAN_INFECTED' })
  })

  it('propagates the inconclusive envelope when the library rejects unknown', async () => {
    /*
     * Scenario: rejectOnUnknown is on and the library rejects an unknown body.
     * Rule it protects: the 422 STORAGE_SCAN_INCONCLUSIVE envelope propagates untouched.
     */
    const { service, upload } = setup({ scanner: { mode: 'pre-upload', rejectOnUnknown: true } })
    upload.mockRejectedValue(new StorageException('STORAGE_SCAN_INCONCLUSIVE'))
    await expect(service.upload({ content: 'X-DEMO-UNKNOWN', keySeed: 'x' })).rejects.toMatchObject(
      { code: 'STORAGE_SCAN_INCONCLUSIVE' },
    )
  })

  it('reports existence from the storage probe', async () => {
    /*
     * Scenario: the removal proof probes a key after an infected upload.
     * Rule it protects: the service returns the storage exists() result verbatim.
     */
    const { service, exists } = setup()
    exists.mockResolvedValue(false)
    await expect(service.exists('scanner-lab/gone')).resolves.toEqual({
      key: 'scanner-lab/gone',
      exists: false,
    })
  })

  it('renders the enabled config with the resolved mode and reject flag', () => {
    /*
     * Scenario: a scanner is configured with post-upload mode and rejectOnUnknown.
     * Rule it protects: config reflects the configured mode and flag verbatim.
     */
    const { service } = setup({ scanner: { mode: 'post-upload', rejectOnUnknown: true } })
    expect(service.config()).toEqual({ enabled: true, mode: 'post-upload', rejectOnUnknown: true })
  })

  it('defaults the mode to pre-upload and reject flag to false', () => {
    /*
     * Scenario: a scanner is configured without an explicit mode or reject flag.
     * Rule it protects: the mode defaults to pre-upload and rejectOnUnknown to false.
     */
    const { service } = setup({ scanner: {} })
    expect(service.config()).toEqual({ enabled: true, mode: 'pre-upload', rejectOnUnknown: false })
  })

  it('reports scanning disabled when no scanner is configured', () => {
    /*
     * Scenario: the module carries no scanner block.
     * Rule it protects: config reports disabled with a null mode.
     */
    const { service } = setup({})
    expect(service.config()).toEqual({ enabled: false, mode: null, rejectOnUnknown: false })
  })
})
