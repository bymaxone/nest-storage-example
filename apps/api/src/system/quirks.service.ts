/**
 * @fileoverview Provider-quirk demonstrations: the three S3-compatibility traps
 * the library documents. The checksum demo uploads the same body twice: once
 * through a scoped `WHEN_SUPPORTED` instance and once through the running module's
 * instance (running its configured checksum mode), reporting BOTH real outcomes
 * side by side, honest
 * about the fact that whether MinIO rejects the SDK default checksums is
 * version-dependent. The ACL card restates the library's documented guidance, and
 * the network card renders the retry/timeout knobs (including the honest note that
 * the shipped library does not currently wire `requestTimeoutMs`). Spec §12.6-§12.8.
 * @layer api/system
 */
import { Inject, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
// Value imports: StorageService is a constructor dependency and StorageException
// is used for an `instanceof` guard, so both must exist at runtime.
import { BYMAX_STORAGE_OPTIONS, StorageException, StorageService } from '@bymax-one/nest-storage'
import type {
  BymaxStorageModuleOptions,
  UploadOptions,
  UploadResult,
} from '@bymax-one/nest-storage'
import { ScopedStorageFactory } from '../common/scoped-storage.factory.js'

/** Narrow view of the resolved options this service reads. */
export interface QuirksResolvedOptions {
  endpoint: string
  region: string
  bucket: string
  forcePathStyle: boolean
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
  requestChecksumCalculation: 'WHEN_SUPPORTED' | 'WHEN_REQUIRED'
  maxAttempts: number
  requestTimeoutMs: number
}

/** One checksum-mode upload outcome. */
export interface ChecksumModeOutcome {
  /** The checksum mode the instance ran with. */
  mode: 'WHEN_SUPPORTED' | 'WHEN_REQUIRED'
  /** True when the provider accepted the upload. */
  ok: boolean
  /** Human-readable outcome (etag on success, mapped code on rejection). */
  detail: string
}

/** Side-by-side checksum-demo result. */
export interface ChecksumDemoView {
  /** Outcome of the SDK-default (`WHEN_SUPPORTED`) upload against the provider. */
  supportedMode: ChecksumModeOutcome
  /** Outcome of the running module's upload, labelled with its configured checksum mode. */
  requiredMode: ChecksumModeOutcome
  /** True when the two modes diverged (the trap the recipes protect against). */
  diverged: boolean
  /** The documented guidance explaining the checksum trap. */
  guidance: string
}

/** The ACL honesty card. */
export interface AclGuidanceView {
  /** What `publicRead: true` actually does across providers. */
  behavior: string
  /** The library error code a rejected ACL is mapped to. */
  mappedErrorCode: string
  /** The documented alternatives to ACL public-read. */
  guidance: string[]
}

/** The network/retry knobs card. */
export interface NetworkKnobsView {
  /** Total attempts including the first try. */
  maxAttempts: number
  /** Retries after the first attempt (`maxAttempts - 1`). */
  retries: number
  /** Configured per-request timeout in milliseconds. */
  requestTimeoutMs: number
  /** The attempts-vs-retries clarification. */
  semantics: string
  /** Honest caveat about the shipped library's handling of `requestTimeoutMs`. */
  caveat: string
}

/** Documented guidance for the checksum trap. */
const CHECKSUM_GUIDANCE =
  'AWS SDK v3 defaults to WHEN_SUPPORTED (CRC32 integrity headers). Non-AWS providers historically reject them, so every non-AWS recipe sets WHEN_REQUIRED. Whether a given MinIO build rejects the SDK default is version-dependent; this demo reports the real outcomes rather than assuming one.'

/** Drives the three provider-quirk demonstrations. */
@Injectable()
export class QuirksService {
  constructor(
    private readonly storage: StorageService,
    private readonly scoped: ScopedStorageFactory,
    @Inject(BYMAX_STORAGE_OPTIONS) private readonly options: QuirksResolvedOptions,
  ) {}

  /**
   * Uploads the same body through a scoped `WHEN_SUPPORTED` instance and through
   * the running module (labelled with its configured checksum mode), reporting
   * both real outcomes so the checksum trap is visible without pretending either
   * mode always fails.
   *
   * @returns Both mode outcomes, whether they diverged, and the guidance.
   */
  async checksumDemo(): Promise<ChecksumDemoView> {
    const instance = await this.scoped.storage(
      'checksum-when-supported',
      this.whenSupportedOptions(),
    )
    const supportedMode = await this.runUpload((o) => instance.upload(o), 'WHEN_SUPPORTED')
    const requiredMode = await this.runUpload(
      (o) => this.storage.upload(o),
      this.options.requestChecksumCalculation,
    )
    return {
      supportedMode,
      requiredMode,
      diverged: supportedMode.ok !== requiredMode.ok,
      guidance: CHECKSUM_GUIDANCE,
    }
  }

  /**
   * Renders the ACL honesty card: what `publicRead` actually does per provider,
   * the library error code a rejected ACL maps to, and the alternatives.
   *
   * @returns The ACL guidance payload.
   */
  aclGuidance(): AclGuidanceView {
    return {
      behavior:
        'publicRead: true emits an x-amz-acl: public-read header. Modern AWS S3 buckets (Object Ownership = "Bucket owner enforced") reject it with HTTP 400 AccessControlListNotSupported; Cloudflare R2 ignores it (no-op). Only legacy ACL-enabled buckets honor it.',
      mappedErrorCode: 'STORAGE_PROVIDER_ERROR',
      guidance: [
        'Prefer a bucket policy for anonymous read access.',
        'Serve public objects through a CDN in front of the bucket.',
        'Issue short-lived signed GET URLs for per-request access.',
      ],
    }
  }

  /**
   * Renders the retry/timeout knobs, including the honest caveat that the shipped
   * library resolves but does not currently wire `requestTimeoutMs`.
   *
   * @returns The network knobs payload.
   */
  networkKnobs(): NetworkKnobsView {
    return {
      maxAttempts: this.options.maxAttempts,
      retries: this.options.maxAttempts - 1,
      requestTimeoutMs: this.options.requestTimeoutMs,
      semantics: 'maxAttempts counts the first try plus retries, so attempts = retries + 1.',
      caveat:
        'The shipped library resolves requestTimeoutMs from options but does not currently wire it into the S3 client request handler; treat it as advisory until the library wires a request/connection timeout.',
    }
  }

  /** Runs one upload attempt, capturing the real outcome without rewriting it. */
  private async runUpload(
    upload: (options: UploadOptions) => Promise<UploadResult>,
    mode: 'WHEN_SUPPORTED' | 'WHEN_REQUIRED',
  ): Promise<ChecksumModeOutcome> {
    const body = Buffer.from('checksum probe body')
    try {
      const result = await upload({
        key: `system/quirks/checksum-${randomUUID()}`,
        body,
        contentType: 'text/plain',
        size: body.byteLength,
      })
      return { mode, ok: true, detail: `Upload accepted (etag ${result.etag}).` }
    } catch (error) {
      if (error instanceof StorageException) {
        return { mode, ok: false, detail: `Rejected by the provider and mapped to ${error.code}.` }
      }
      throw error
    }
  }

  /**
   * Builds scoped options that match the running module (including the resolved
   * retry and timeout knobs) except for the checksum mode under demonstration,
   * which is forced to `WHEN_SUPPORTED`.
   */
  private whenSupportedOptions(): BymaxStorageModuleOptions {
    return {
      endpoint: this.options.endpoint,
      region: this.options.region,
      bucket: this.options.bucket,
      forcePathStyle: this.options.forcePathStyle,
      credentials: {
        accessKeyId: this.options.credentials.accessKeyId,
        secretAccessKey: this.options.credentials.secretAccessKey,
        ...(this.options.credentials.sessionToken !== undefined
          ? { sessionToken: this.options.credentials.sessionToken }
          : {}),
      },
      maxAttempts: this.options.maxAttempts,
      requestTimeoutMs: this.options.requestTimeoutMs,
      requestChecksumCalculation: 'WHEN_SUPPORTED',
      responseChecksumValidation: 'WHEN_SUPPORTED',
    }
  }
}
