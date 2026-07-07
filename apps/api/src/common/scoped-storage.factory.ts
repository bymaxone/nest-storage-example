/**
 * @fileoverview Builds auxiliary, deliberately-misconfigured `BymaxStorageModule`
 * instances so error and provider-quirk demonstrations are DETERMINISTIC and
 * self-contained: an unconfigured instance, a wrong-credentials instance, an
 * unroutable-endpoint instance, and a checksum-mode instance each reproduce a
 * specific outcome on demand rather than relying on provider flakiness.
 *
 * Each instance is a full Nest application context created lazily and cached by
 * label, then closed once on application shutdown so no S3 client leaks. The
 * library code is loaded once per process, so the extra contexts add provider
 * objects, not duplicate module graphs.
 * @layer api/common
 */
import {
  Injectable,
  type INestApplicationContext,
  type OnApplicationShutdown,
} from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
// Value imports: the tokens/services are resolved out of the scoped context at
// runtime, so the classes must exist as values (not type-only imports).
import { BymaxStorageModule, SignedUrlService, StorageService } from '@bymax-one/nest-storage'
import type { BymaxStorageModuleOptions } from '@bymax-one/nest-storage'

/** Lazily builds and caches misconfigured storage instances for demos. */
@Injectable()
export class ScopedStorageFactory implements OnApplicationShutdown {
  private readonly contexts = new Map<string, Promise<INestApplicationContext>>()

  /**
   * Resolves the `StorageService` from a labelled scoped instance, building the
   * instance on first use and reusing it thereafter.
   *
   * @param label - Stable cache key identifying this instance.
   * @param options - The (deliberately misconfigured) module options.
   * @returns The scoped instance's `StorageService`.
   */
  async storage(label: string, options: BymaxStorageModuleOptions): Promise<StorageService> {
    const context = await this.context(label, options)
    return context.get(StorageService, { strict: false })
  }

  /**
   * Resolves the `SignedUrlService` from a labelled scoped instance.
   *
   * @param label - Stable cache key identifying this instance.
   * @param options - The (deliberately misconfigured) module options.
   * @returns The scoped instance's `SignedUrlService`.
   */
  async signedUrls(label: string, options: BymaxStorageModuleOptions): Promise<SignedUrlService> {
    const context = await this.context(label, options)
    return context.get(SignedUrlService, { strict: false })
  }

  /**
   * Closes every scoped instance on application shutdown, releasing each S3
   * client. Clears the cache so a subsequent boot rebuilds cleanly.
   */
  async onApplicationShutdown(): Promise<void> {
    const contexts = [...this.contexts.values()]
    this.contexts.clear()
    await Promise.all(contexts.map(async (pending) => (await pending).close()))
  }

  /** Returns the cached context for a label, building it on the first request. */
  private context(
    label: string,
    options: BymaxStorageModuleOptions,
  ): Promise<INestApplicationContext> {
    const existing = this.contexts.get(label)
    if (existing !== undefined) {
      return existing
    }
    const created = NestFactory.createApplicationContext(BymaxStorageModule.forRoot(options), {
      logger: false,
    })
    this.contexts.set(label, created)
    return created
  }
}
