/**
 * Unit: ConfirmService - post-direct-upload verification.
 *
 * Mocks `StorageService.head` and the `IConfirmScanner` seam directly. Covers:
 * the happy path (size + MIME pass, CLEAN scan => confirmed), the honest
 * not-clean verdicts (skipped/unknown/infected all fail scanClean and confirm),
 * size-policy violation, MIME-mismatch refusal, the no-size-policy branch, the
 * no-whitelist branch (nothing to enforce => mimeAllowed true), not-found
 * propagation, and the exported `isMimeAllowed` matcher.
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
  it('confirms an object within policy with a CLEAN scan verdict', async () => {
    /*
     * Scenario: a landed object passes size and MIME and the scanner returns clean.
     * Rule it protects: confirmed is true only when an actual clean verdict backs it.
     */
    const { service, head, scan } = setup({ status: 'clean' })
    head.mockResolvedValue(makeMetadata({ size: 1024, contentType: 'image/png' }))
    const res = await service.confirm('avatars/uuid.png')
    expect(res.confirmed).toBe(true)
    expect(res.checks).toEqual({ sizeWithinPolicy: true, mimeAllowed: true, scanClean: true })
    expect(res.scan).toEqual({ status: 'clean' })
    expect(res.note).toContain('bypasses')
    expect(scan).toHaveBeenCalledWith('avatars/uuid.png', 'vault')
  })

  it('does not confirm on a skipped scan even when size and MIME pass', async () => {
    /*
     * Scenario: the no-op scanner returns skipped for a size/MIME-valid object.
     * Rule it protects: skipped is NOT clean, so a direct upload stays untrusted
     * until a real scanner actually inspects it (honest trust model).
     */
    const { service, head } = setup({ status: 'skipped' })
    head.mockResolvedValue(makeMetadata({ size: 1024, contentType: 'image/png' }))
    const res = await service.confirm('avatars/uuid.png')
    expect(res.checks).toEqual({ sizeWithinPolicy: true, mimeAllowed: true, scanClean: false })
    expect(res.confirmed).toBe(false)
  })

  it('does not confirm on an unknown scan verdict', async () => {
    /*
     * Scenario: the scanner could not decide (unknown).
     * Rule it protects: only a clean verdict counts as clean; unknown fails confirm.
     */
    const { service, head } = setup({ status: 'unknown' })
    head.mockResolvedValue(makeMetadata({ size: 1024, contentType: 'image/png' }))
    const res = await service.confirm('avatars/uuid.png')
    expect(res.checks.scanClean).toBe(false)
    expect(res.confirmed).toBe(false)
  })

  it('accepts an object whose size exactly equals the policy maximum', async () => {
    /*
     * Scenario: the landed object is exactly maxSizeBytes (4096).
     * Rule it protects: the size bound is inclusive (size <= max), so a size equal
     * to the cap passes. A mutant that flips <= to < would wrongly refuse it.
     */
    const { service, head } = setup({ status: 'clean' })
    head.mockResolvedValue(makeMetadata({ size: 4096, contentType: 'image/png' }))
    const res = await service.confirm('avatars/uuid.png')
    expect(res.checks.sizeWithinPolicy).toBe(true)
    expect(res.confirmed).toBe(true)
  })

  it('passes the MIME check when the configured whitelist is empty', async () => {
    /*
     * Scenario: the validation policy carries an empty mimeWhitelist array.
     * Rule it protects: an empty whitelist means nothing to enforce, so mimeAllowed
     * passes (the `length === 0` guard). A mutant that drops the guard would call
     * the matcher against an empty list and refuse every type.
     */
    const { service, head } = setup(
      { status: 'skipped' },
      makeOptions({ validation: { maxSizeBytes: 4096, mimeWhitelist: [] } }),
    )
    head.mockResolvedValue(makeMetadata({ contentType: 'application/zip' }))
    const res = await service.confirm('avatars/uuid.png')
    expect(res.checks.mimeAllowed).toBe(true)
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
    const { service, head } = setup({ status: 'infected', threat: 'Demo.Marker.A' })
    head.mockResolvedValue(makeMetadata())
    const res = await service.confirm('avatars/uuid.png')
    expect(res.confirmed).toBe(false)
    expect(res.checks.scanClean).toBe(false)
    expect(res.scan).toEqual({ status: 'infected', threat: 'Demo.Marker.A' })
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

  it('allows any MIME when no whitelist is configured', async () => {
    /*
     * Scenario: the module carries no validation policy at all.
     * Rule it protects: with no whitelist there is nothing to enforce, so
     * mimeAllowed passes (mirroring the size-policy semantics); the absent size
     * policy passes too, and scanClean is false under the no-op scanner.
     */
    const options: StoragePolicyOptions = {
      bucket: 'vault',
      keyPrefix: 'storage-example',
      signedUrls: { defaultGetTtlSeconds: 300, defaultPutTtlSeconds: 300, maxTtlSeconds: 3600 },
    }
    const { service, head } = setup({ status: 'skipped' }, options)
    head.mockResolvedValue(makeMetadata({ contentType: 'application/zip' }))
    const res = await service.confirm('avatars/uuid.png')
    expect(res.checks).toEqual({ sizeWithinPolicy: true, mimeAllowed: true, scanClean: false })
    expect(res.confirmed).toBe(false)
  })

  it('applies the whitelist when one is configured, refusing a mismatch', async () => {
    /*
     * Scenario: a whitelist is configured and the landed type is outside it.
     * Rule it protects: a configured whitelist is enforced (mimeAllowed false).
     */
    const { service, head } = setup(
      { status: 'clean' },
      makeOptions({ validation: { mimeWhitelist: ['image/png'] } }),
    )
    head.mockResolvedValue(makeMetadata({ contentType: 'application/zip' }))
    const res = await service.confirm('avatars/uuid.png')
    expect(res.checks.mimeAllowed).toBe(false)
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

  it('rejects an absent content type even against a catch-all entry', () => {
    /*
     * Scenario: the whitelist is a bare star but the content type is absent.
     * Rule it protects: the empty/undefined guard runs BEFORE the wildcard match,
     * so an absent MIME is refused even when a `*` entry would otherwise allow
     * anything (a mutant that removes the guard would wrongly allow it).
     */
    expect(isMimeAllowed(undefined, ['*'])).toBe(false)
    expect(isMimeAllowed('', ['*'])).toBe(false)
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

  it('anchors a type/* wildcard at the full prefix, not the first character', () => {
    /*
     * Scenario: a type outside a `image/*` wildcard is tested.
     * Rule it protects: the prefix compared is `image/` (entry without its
     * trailing `*`), so `irrelevant/x` does NOT match. A mutant that slices the
     * wrong end (leaving `i`) would wrongly match any `i...` type.
     */
    expect(isMimeAllowed('irrelevant/x', ['image/*'])).toBe(false)
    expect(isMimeAllowed('image/png', ['image/*'])).toBe(true)
  })

  it('rejects a type outside the whitelist', () => {
    /*
     * Scenario: the type matches no entry.
     * Rule it protects: unlisted types are refused.
     */
    expect(isMimeAllowed('application/zip', ['image/png', 'video/*'])).toBe(false)
  })
})
