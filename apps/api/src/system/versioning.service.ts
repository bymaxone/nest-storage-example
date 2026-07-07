/**
 * @fileoverview Bucket-versioning status via the raw `S3Client` escape hatch.
 * This is the ONE place the app reaches past the library facade to the injected
 * `BYMAX_STORAGE_S3_CLIENT`, because per-bucket versioning status is an advanced
 * provider operation the facade does not expose. The documented trade-off is
 * abstraction loss: this call is coupled to the AWS SDK and forgoes the library's
 * key-prefix, error-mapping, and multi-provider guarantees (spec §11.1).
 * @layer api/system
 */
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GetBucketVersioningCommand } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'
// StorageException is used to raise the typed not-configured envelope; the token
// is a plain symbol so it is imported as a value for the injection decorator.
import { BYMAX_STORAGE_S3_CLIENT, StorageException } from '@bymax-one/nest-storage'
import type { Env } from '../config/env.schema.js'

/** Versioning status for a single bucket. */
export interface BucketVersioning {
  /** The bucket name. */
  bucket: string
  /** `Enabled`, `Suspended`, or `Unversioned` when the provider reports no status. */
  status: 'Enabled' | 'Suspended' | 'Unversioned'
}

/** The versioning-status view with the abstraction-loss trade-off note. */
export interface VersioningView {
  /** Per-bucket versioning status across the three application buckets. */
  buckets: BucketVersioning[]
  /** The documented trade-off of using the raw client. */
  tradeOffNote: string
}

/** The abstraction-loss note attached to every raw-client response. */
const TRADE_OFF_NOTE =
  'This status comes from the raw S3Client (BYMAX_STORAGE_S3_CLIENT), not the library facade. Reaching past the facade couples this call to the AWS SDK and forgoes the library key-prefix, error mapping, and provider-agnostic guarantees; reserve it for advanced operations the facade does not cover.'

/** Reads per-bucket versioning status through the raw S3 client. */
@Injectable()
export class VersioningService {
  private readonly buckets: readonly string[]

  constructor(
    @Inject(BYMAX_STORAGE_S3_CLIENT) private readonly client: S3Client | null,
    config: ConfigService<{ env: Env }, true>,
  ) {
    const env = config.get('env', { infer: true })
    this.buckets = [env.STORAGE_BUCKET, env.STORAGE_ARCHIVE_BUCKET, env.STORAGE_VERSIONED_BUCKET]
  }

  /**
   * Returns the versioning status of the three application buckets via the raw
   * client. When storage is unconfigured the raw client is `null` and the typed
   * not-configured envelope is raised.
   *
   * @returns The per-bucket versioning status plus the trade-off note.
   * @throws {StorageException} `STORAGE_NOT_CONFIGURED` when the raw client is absent.
   */
  async versioningStatus(): Promise<VersioningView> {
    const client = this.client
    if (client === null) {
      throw new StorageException('STORAGE_NOT_CONFIGURED')
    }
    const buckets = await Promise.all(this.buckets.map((bucket) => this.statusFor(client, bucket)))
    return { buckets, tradeOffNote: TRADE_OFF_NOTE }
  }

  /** Reads one bucket's versioning status; an absent provider status is `Unversioned`. */
  private async statusFor(client: S3Client, bucket: string): Promise<BucketVersioning> {
    const response = await client.send(new GetBucketVersioningCommand({ Bucket: bucket }))
    return { bucket, status: response.Status ?? 'Unversioned' }
  }
}
