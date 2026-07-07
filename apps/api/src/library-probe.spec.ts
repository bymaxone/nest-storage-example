/**
 * Unit: the compile-time resolution probe also resolves at runtime.
 *
 * Importing the probe executes its object literal, proving every symbol pulled
 * from both `@bymax-one/nest-storage` subpaths (`.` and `./shared`) is a live
 * runtime value - not just a type - so a broken `exports` map or dual build
 * fails here as well as under `tsc`.
 *
 * @module library-probe.spec
 */
import { nestStorageResolutionProbe } from './library-probe.js'

describe('nestStorageResolutionProbe (unit)', () => {
  it('exposes a live runtime value for every probed library symbol', () => {
    /*
     * Scenario: read each entry the probe imported from the two subpaths.
     * Rule it protects: the server module, the two services, the recipes map, the
     * shared error codes, and the shared TTL constant all resolve to defined
     * runtime values, so the package resolution path is proven end to end.
     */
    expect(nestStorageResolutionProbe.serverModule).toBeDefined()
    expect(nestStorageResolutionProbe.storageService).toBeDefined()
    expect(nestStorageResolutionProbe.signedUrlService).toBeDefined()
    expect(nestStorageResolutionProbe.providerRecipes).toBeDefined()
    expect(nestStorageResolutionProbe.storageErrorCodes.STORAGE_NOT_CONFIGURED).toBe(
      'STORAGE_NOT_CONFIGURED',
    )
    expect(nestStorageResolutionProbe.defaultSignedUrlTtlSeconds).toBe(300)
  })
})
