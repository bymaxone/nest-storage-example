/**
 * Unit: ConfirmService - post-direct-upload verification.
 *
 * Mocks `StorageService.head` and the `IConfirmScanner` seam directly. Covers:
 * the happy path (size + MIME pass, scanner skipped), size-policy violation,
 * MIME-mismatch refusal, infected-scan refusal, the no-size-policy branch,
 * not-found propagation, and the exported `isMimeAllowed` matcher.
 *
 * @module signed/confirm.service.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { StorageException } from '@bymax-one/nest-storage'
import type { StorageService, ObjectMetadata } from '@bymax-one/nest-storage'
import { ConfirmService, isMimeAllowed } from './confirm.service.js'
import type { StoragePolicyOptions } from './storage-policy.js'
import type { IConfirmScanner, ScanVerdict } from './confirm-scanner.js'

/** Minimal ObjectMetadata stub. */
function makeMetadata(overrides: Partial<ObjectMetadata> = {}): ObjectMetadata {
  return {
    key: 'storage-example/avatars/uuid.png',
    bucket: 'vault',
    size: 1024,
    contentType: 'image/png',
    etag: '"abc"',
    lastModified: new Date('2026-01-01'),
    metadata: {},
    ...overrides,
  }
}

/** Default policy options for the confirm service. */
function makeOptions(overrides: Partial<StoragePolicyOptions> = {}): StoragePolicyOptions {
  return {
    bucket: 'vault',
    keyPrefix: 'storage-example',
    signedUrls: { defaultGetTtlSeconds: 300, defaultPutTtlSeconds: 300, maxTtlSeconds: 3600 },
    validation: { maxSizeBytes: 4096, mimeWhitelist: ['image/png', 'video/*'] },
    ...overrides,
  }
}

/**
 * Builds the service with a mocked storage head and scanner.
 *
 * @param verdict - The scan verdict the seam returns.
 * @param options - Policy options override.
 * @returns The service and its mock functions.
 */
function setup(
  verdict: ScanVerdict = { status: 'skipped' },
  options: StoragePolicyOptions = makeOptions(),
) {
  const head = jest.fn<StorageService['head']>()
  const storage = { head } as unknown as StorageService
  const scan = jest.fn<IConfirmScanner['scan']>().mockResolvedValue(verdict)
  const scanner: IConfirmScanner = { scan }
  const service = new ConfirmService(storage, options, scanner)
  return { service, head, scan }
}

describe('ConfirmService (unit)', () => {
  it('confirms an object within policy with a skipped scan', async () => {
    /*
     * Scenario: a landed object passes size and MIME with no scanner wired.
     * Rule it protects: confirmed is true and every check reports true.
     */
    const { service, head, scan } = setup()
    head.mockResolvedValue(makeMetadata({ size: 1024, contentType: 'image/png' }))
    const res = await service.confirm('avatars/uuid.png')
    expect(res.confirmed).toBe(true)
    expect(res.checks).toEqual({ sizeWithinPolicy: true, mimeAllowed: true, scanClean: true })
    expect(res.scan).toEqual({ status: 'skipped' })
    expect(res.note).toContain('bypasses')
    expect(scan).toHaveBeenCalledWith('avatars/uuid.png', 'vault')
  })

  it('refuses an object exceeding the size policy', async () => {
    /*
     * Scenario: the landed object is larger than maxSizeBytes.
     * Rule it protects: confirm surfaces the size breach the direct PUT bypassed.
     */
    const { service, head } = setup()
    head.mockResolvedValue(makeMetadata({ size: 8192, contentType: 'image/png' }))
    const res = await service.confirm('avatars/uuid.png')
    expect(res.confirmed).toBe(false)
    expect(res.checks.sizeWithinPolicy).toBe(false)
  })

  it('refuses an object whose content type is not whitelisted', async () => {
    /*
     * Scenario: the landed object is application/zip, outside the whitelist.
     * Rule it protects: confirm re-applies the MIME policy the direct PUT skipped.
     */
    const { service, head } = setup()
    head.mockResolvedValue(makeMetadata({ contentType: 'application/zip' }))
    const res = await service.confirm('avatars/uuid.png')
    expect(res.confirmed).toBe(false)
    expect(res.checks.mimeAllowed).toBe(false)
  })

  it('refuses an infected object', async () => {
    /*
     * Scenario: the scanner seam reports a threat.
     * Rule it protects: an infected verdict fails the confirm.
     */
    const { service, head } = setup({ status: 'infected', threat: 'EICAR' })
    head.mockResolvedValue(makeMetadata())
    const res = await service.confirm('avatars/uuid.png')
    expect(res.confirmed).toBe(false)
    expect(res.checks.scanClean).toBe(false)
    expect(res.scan).toEqual({ status: 'infected', threat: 'EICAR' })
  })

  it('passes the size check when no size policy is configured', async () => {
    /*
     * Scenario: the validation policy carries no maxSizeBytes.
     * Rule it protects: with nothing to enforce, the size check passes.
     */
    const { service, head } = setup(
      { status: 'skipped' },
      makeOptions({ validation: { mimeWhitelist: ['image/png'] } }),
    )
    head.mockResolvedValue(makeMetadata({ size: 10_000_000, contentType: 'image/png' }))
    const res = await service.confirm('avatars/uuid.png')
    expect(res.checks.sizeWithinPolicy).toBe(true)
  })

  it('refuses when no validation policy is configured (empty whitelist)', async () => {
    /*
     * Scenario: the module carries no validation policy at all.
     * Rule it protects: the MIME whitelist defaults to empty, so nothing is
     * allowed, while the absent size policy passes.
     */
    const options: StoragePolicyOptions = {
      bucket: 'vault',
      keyPrefix: 'storage-example',
      signedUrls: { defaultGetTtlSeconds: 300, defaultPutTtlSeconds: 300, maxTtlSeconds: 3600 },
    }
    const { service, head } = setup({ status: 'skipped' }, options)
    head.mockResolvedValue(makeMetadata({ contentType: 'image/png' }))
    const res = await service.confirm('avatars/uuid.png')
    expect(res.checks).toEqual({ sizeWithinPolicy: true, mimeAllowed: false, scanClean: true })
    expect(res.confirmed).toBe(false)
  })

  it('propagates the not-found envelope for a key that never landed', async () => {
    /*
     * Scenario: head() reports the key is absent.
     * Rule it protects: the 404 STORAGE_OBJECT_NOT_FOUND envelope propagates.
     */
    const { service, head } = setup()
    head.mockRejectedValue(new StorageException('STORAGE_OBJECT_NOT_FOUND'))
    await expect(service.confirm('avatars/missing.png')).rejects.toMatchObject({
      code: 'STORAGE_OBJECT_NOT_FOUND',
    })
  })
})

describe('isMimeAllowed', () => {
  it('rejects an undefined or empty content type', () => {
    /*
     * Scenario: the landed object has no content type.
     * Rule it protects: an absent MIME is never allowed.
     */
    expect(isMimeAllowed(undefined, ['image/png'])).toBe(false)
    expect(isMimeAllowed('', ['image/png'])).toBe(false)
  })

  it('allows any type for a bare or full wildcard', () => {
    /*
     * Scenario: the whitelist contains a catch-all entry.
     * Rule it protects: a bare star and a full type-subtype star permit any type.
     */
    expect(isMimeAllowed('application/zip', ['*'])).toBe(true)
    expect(isMimeAllowed('application/zip', ['*/*'])).toBe(true)
  })

  it('matches a type/* prefix wildcard and exact entries', () => {
    /*
     * Scenario: the whitelist mixes a wildcard and an exact type.
     * Rule it protects: both prefix and exact matches are honored.
     */
    expect(isMimeAllowed('video/mp4', ['video/*'])).toBe(true)
    expect(isMimeAllowed('image/png', ['image/png'])).toBe(true)
  })

  it('rejects a type outside the whitelist', () => {
    /*
     * Scenario: the type matches no entry.
     * Rule it protects: unlisted types are refused.
     */
    expect(isMimeAllowed('application/zip', ['image/png', 'video/*'])).toBe(false)
  })
})
