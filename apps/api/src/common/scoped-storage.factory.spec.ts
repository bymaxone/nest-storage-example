/**
 * Unit: ScopedStorageFactory - lazily builds and caches misconfigured instances.
 *
 * Builds a real (credential-less, network-free) scoped instance and covers the
 * storage/signedUrls resolution, the cache reuse (same singleton on a repeat
 * call), and the shutdown that closes contexts and clears the cache so a later
 * request rebuilds a fresh instance.
 *
 * @module common/scoped-storage.factory.spec
 */
import 'reflect-metadata'
import { SignedUrlService, StorageService } from '@bymax-one/nest-storage'
import type { BymaxStorageModuleOptions } from '@bymax-one/nest-storage'
import { ScopedStorageFactory } from './scoped-storage.factory.js'

/** Credential-less options: the instance builds but never opens a connection. */
const OPTIONS: BymaxStorageModuleOptions = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  bucket: 'vault',
  credentials: { accessKeyId: '', secretAccessKey: '' },
  forcePathStyle: true,
}

describe('ScopedStorageFactory (unit)', () => {
  it('resolves the storage and signed-url facades from a scoped instance', async () => {
    /*
     * Scenario: a labelled scoped instance is requested.
     * Rule it protects: both library facades resolve out of the built context.
     */
    const factory = new ScopedStorageFactory()
    const storage = await factory.storage('probe', OPTIONS)
    const signed = await factory.signedUrls('probe', OPTIONS)
    expect(storage).toBeInstanceOf(StorageService)
    expect(signed).toBeInstanceOf(SignedUrlService)
    await factory.onApplicationShutdown()
  })

  it('reuses the cached instance for the same label', async () => {
    /*
     * Scenario: the same label is requested twice.
     * Rule it protects: the instance is built once and reused (same singleton).
     */
    const factory = new ScopedStorageFactory()
    const first = await factory.storage('reused', OPTIONS)
    const second = await factory.storage('reused', OPTIONS)
    expect(second).toBe(first)
    await factory.onApplicationShutdown()
  })

  it('closes and clears instances on shutdown so a later request rebuilds', async () => {
    /*
     * Scenario: the app shuts down, then a new request arrives.
     * Rule it protects: shutdown clears the cache and a fresh instance is built.
     */
    const factory = new ScopedStorageFactory()
    const before = await factory.storage('cycle', OPTIONS)
    await factory.onApplicationShutdown()
    const after = await factory.storage('cycle', OPTIONS)
    expect(after).not.toBe(before)
    await factory.onApplicationShutdown()
  })
})
