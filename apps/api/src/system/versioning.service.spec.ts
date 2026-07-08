/**
 * Unit: VersioningService - raw-client per-bucket versioning status.
 *
 * Mocks the injected S3Client `send` and the ConfigService. Covers the mapping of
 * the provider Status (Enabled / absent -> Unversioned) across the three buckets,
 * the trade-off note, and the not-configured path when the raw client is null.
 *
 * @module system/versioning.service.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import type { S3Client } from '@aws-sdk/client-s3'
import type { ConfigService } from '@nestjs/config'
import { VersioningService } from './versioning.service.js'

/** Env view returned by the mocked ConfigService. */
const ENV = {
  STORAGE_BUCKET: 'vault',
  STORAGE_ARCHIVE_BUCKET: 'vault-archive',
  STORAGE_VERSIONED_BUCKET: 'vault-versioned',
}

/** Builds a ConfigService mock returning the three bucket names. */
function configMock() {
  const get = jest.fn().mockReturnValue(ENV)
  return { get } as unknown as ConfigService<{ env: never }, true>
}

describe('VersioningService (unit)', () => {
  it('maps provider status across the three buckets and attaches the trade-off note', async () => {
    /*
     * Scenario: the versioned bucket reports Enabled, the others report no status.
     * Rule it protects: each bucket is probed via the raw client and an absent
     * status maps to Unversioned; the abstraction-loss note is attached.
     */
    const send = jest.fn((command: { input: { Bucket: string } }) =>
      Promise.resolve(command.input.Bucket === 'vault-versioned' ? { Status: 'Enabled' } : {}),
    )
    const client = { send } as unknown as S3Client
    const service = new VersioningService(client, configMock())
    const view = await service.versioningStatus()
    expect(send).toHaveBeenCalledTimes(3)
    expect(view.buckets).toEqual([
      { bucket: 'vault', status: 'Unversioned' },
      { bucket: 'vault-archive', status: 'Unversioned' },
      { bucket: 'vault-versioned', status: 'Enabled' },
    ])
    expect(view.tradeOffNote).toContain('raw S3Client')
  })

  it('reads the env namespace with type inference enabled', () => {
    /*
     * Scenario: the service resolves its bucket list from the config on construction.
     * Rule it protects: the ConfigService is queried with exactly ('env', { infer:
     * true }), so a mutant that empties the options object or flips infer is caught.
     */
    const get = jest.fn().mockReturnValue(ENV)
    const config = { get } as unknown as ConfigService<{ env: never }, true>
    const service = new VersioningService({ send: jest.fn() } as unknown as S3Client, config)
    expect(service).toBeDefined()
    expect(get).toHaveBeenCalledWith('env', { infer: true })
  })

  it('raises the not-configured envelope when the raw client is null', async () => {
    /*
     * Scenario: storage is unconfigured, so the raw client token resolves to null.
     * Rule it protects: the endpoint surfaces STORAGE_NOT_CONFIGURED rather than crashing.
     */
    const service = new VersioningService(null, configMock())
    await expect(service.versioningStatus()).rejects.toMatchObject({
      code: 'STORAGE_NOT_CONFIGURED',
    })
  })
})
