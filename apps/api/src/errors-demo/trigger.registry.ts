/**
 * @fileoverview Deterministic triggers for every shipped `STORAGE_ERROR_CODES`.
 * Each trigger reproduces its code through a REAL library call — crafted inputs
 * on the running module, or a scoped misconfigured instance — so the code always
 * arises on demand and its untouched envelope reaches the global filter. No app
 * code fabricates a `StorageException`; the two non-reproducible codes
 * (`STORAGE_PART_TOO_SMALL` and `STORAGE_TIMEOUT`, documented in the catalogue)
 * return an honest explanation instead of a faked throw.
 * @layer api/errors-demo
 */
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
// Value imports: these are used at runtime (constructed / called).
import { BymaxStorageModule } from '@bymax-one/nest-storage'
import type {
  BymaxStorageModuleOptions,
  SignedUrlService,
  StorageErrorCode,
  StorageService,
  UploadOptions,
} from '@bymax-one/nest-storage'
import { MarkerFileScanner } from '../scanner-lab/marker-file.scanner.js'
import type { ScopedStorageFactory } from '../common/scoped-storage.factory.js'

/** A declared size (1 TiB) that always exceeds any configured `maxSizeBytes`. */
const OVERSIZE_BYTES = 1_099_511_627_776

/** Outcome returned for a code the shipped library cannot actually throw. */
export interface TriggerOutcome {
  /** The code that was requested. */
  code: StorageErrorCode
  /** Always `false` — the code is defined but has no throw site. */
  reproducible: false
  /** The honest explanation of why no envelope is produced. */
  note: string
}

/** A single trigger: throws a real `StorageException`, or returns an outcome. */
export type Trigger = () => Promise<TriggerOutcome | void>

/** Connection facts (from the resolved options) used to build scoped instances. */
export interface TriggerConnection {
  endpoint: string
  region: string
  bucket: string
}

/** Collaborators the registry drives to reproduce each code. */
export interface TriggerDeps {
  /** The running module's storage facade (crafted-input triggers). */
  storage: StorageService
  /** The running module's signed-URL facade (TTL / part-count triggers). */
  signedUrls: SignedUrlService
  /** Builder of scoped, misconfigured instances. */
  scoped: ScopedStorageFactory
  /** The real connection facts for the wrong-credentials instance. */
  connection: TriggerConnection
}

/** Builds options for an instance with no credentials (asserts unconfigured). */
function unconfiguredOptions(c: TriggerConnection): BymaxStorageModuleOptions {
  return {
    endpoint: c.endpoint,
    region: c.region,
    bucket: c.bucket,
    credentials: { accessKeyId: '', secretAccessKey: '' },
    forcePathStyle: true,
  }
}

/** Builds options for an instance with wrong credentials against the real endpoint. */
function wrongCredentialsOptions(c: TriggerConnection): BymaxStorageModuleOptions {
  return {
    endpoint: c.endpoint,
    region: c.region,
    bucket: c.bucket,
    credentials: { accessKeyId: 'wrong-access-key', secretAccessKey: 'wrong-secret-key' },
    forcePathStyle: true,
    maxAttempts: 1,
  }
}

/** Builds options for a scan-only instance that rejects an unknown verdict. */
function rejectUnknownOptions(c: TriggerConnection): BymaxStorageModuleOptions {
  return {
    endpoint: c.endpoint,
    region: c.region,
    bucket: c.bucket,
    credentials: { accessKeyId: 'scan-only', secretAccessKey: 'scan-only' },
    forcePathStyle: true,
    scanner: { impl: new MarkerFileScanner(), mode: 'pre-upload', rejectOnUnknown: true },
  }
}

/** Builds an upload request with a deliberately absent body (STORAGE_BODY_MISSING). */
function uploadWithoutBody(key: string): UploadOptions {
  // The single assertion is intentional: the whole point is a malformed call the
  // library must reject before any provider work.
  return { key, contentType: 'text/plain' } as unknown as UploadOptions
}

/** Returns the honest outcome for a defined-but-unthrown code. */
function nonReproducible(code: StorageErrorCode): TriggerOutcome {
  return {
    code,
    reproducible: false,
    note: 'This code is defined in STORAGE_ERROR_CODES but the shipped library has no code path that throws it. See GET /errors for the reconciled explanation.',
  }
}

/** Crafted-input triggers that the running module rejects before any provider call. */
function guardTriggers(storage: StorageService) {
  return {
    STORAGE_KEY_INVALID: async () => {
      await storage.upload({
        key: 'errors-demo/../escape',
        body: Buffer.from('x'),
        contentType: 'text/plain',
        size: 1,
      })
    },
    STORAGE_BODY_MISSING: async () => {
      await storage.upload(uploadWithoutBody('errors-demo/no-body'))
    },
    STORAGE_CONTENT_TYPE_REQUIRED: async () => {
      await storage.upload({
        key: 'errors-demo/no-content-type',
        body: Buffer.from('x'),
        contentType: '',
        size: 1,
      })
    },
    STORAGE_OBJECT_NOT_FOUND: async () => {
      await storage.head(`errors-demo/missing-${randomUUID()}`)
    },
    STORAGE_BUCKET_UNDEFINED: async () => {
      await storage.head('errors-demo/bucket', { bucket: '' })
    },
  }
}

/** Crafted-input triggers that fail inside the validation/scanner pipeline. */
function pipelineTriggers(storage: StorageService) {
  return {
    STORAGE_MIME_NOT_ALLOWED: async () => {
      await storage.upload({
        key: 'errors-demo/disallowed',
        body: Buffer.from('x'),
        contentType: 'application/zip',
        size: 1,
      })
    },
    STORAGE_SIZE_EXCEEDED: async () => {
      await storage.upload({
        key: 'errors-demo/too-large.png',
        body: Buffer.from('x'),
        contentType: 'image/png',
        size: OVERSIZE_BYTES,
      })
    },
    STORAGE_VALIDATION_FAILED: async () => {
      const body = Buffer.from('this is not a pdf')
      await storage.upload({
        key: 'errors-demo/forged.pdf',
        body,
        contentType: 'application/pdf',
        size: body.byteLength,
      })
    },
    STORAGE_SCAN_INFECTED: async () => {
      const body = Buffer.from('X-DEMO-INFECTED sample payload')
      await storage.upload({
        key: 'errors-demo/infected.png',
        body,
        contentType: 'image/png',
        size: body.byteLength,
      })
    },
  }
}

/** Signed-URL triggers (invalid TTL and invalid part count). */
function signedTriggers(signedUrls: SignedUrlService) {
  return {
    STORAGE_SIGNED_URL_TTL_INVALID: async () => {
      await signedUrls.getDownloadUrl({ key: 'errors-demo/ttl', ttlSeconds: 0 })
    },
    STORAGE_INVALID_PART_COUNT: async () => {
      await signedUrls.getMultipartUploadUrls({
        key: 'errors-demo/parts',
        contentType: 'text/plain',
        parts: 0,
      })
    },
  }
}

/** Triggers driven by a scoped, deliberately-misconfigured module instance. */
function scopedTriggers(scoped: ScopedStorageFactory, connection: TriggerConnection) {
  return {
    STORAGE_NOT_CONFIGURED: async () => {
      const instance = await scoped.storage('unconfigured', unconfiguredOptions(connection))
      await instance.head('errors-demo/probe')
    },
    STORAGE_PROVIDER_ERROR: async () => {
      const instance = await scoped.storage(
        'wrong-credentials',
        wrongCredentialsOptions(connection),
      )
      await instance.head('errors-demo/probe')
    },
    STORAGE_SCAN_INCONCLUSIVE: async () => {
      const instance = await scoped.storage('reject-unknown', rejectUnknownOptions(connection))
      const body = Buffer.from('X-DEMO-UNKNOWN sample payload')
      await instance.upload({
        key: 'errors-demo/unknown.txt',
        body,
        contentType: 'text/plain',
        size: body.byteLength,
      })
    },
    STORAGE_MULTIPART_ABORTED: async () => {
      // The multipart path wraps ANY failure of the underlying upload as
      // STORAGE_MULTIPART_ABORTED; a wrong-credentials instance forced onto the
      // multipart path (unknown-size stream) fails CreateMultipartUpload with 403.
      const instance = await scoped.storage(
        'wrong-credentials',
        wrongCredentialsOptions(connection),
      )
      await instance.upload({
        key: 'errors-demo/multipart',
        body: Readable.from([Buffer.from('chunk')]),
        contentType: 'text/plain',
      })
    },
  }
}

/** The boot-probe and the two reconciled non-reproducible codes. */
function staticTriggers() {
  return {
    // forRoot validates synchronously and throws STORAGE_INVALID_CONFIG for an
    // options object missing the required fields; the deferred call turns that
    // synchronous throw into a rejected promise the filter renders.
    STORAGE_INVALID_CONFIG: () =>
      Promise.resolve().then(() => {
        BymaxStorageModule.forRoot({} as BymaxStorageModuleOptions)
      }),
    // Reconciled drift: neither maps to a code the shipped library can raise from
    // a library-issued request (see the catalogue), so both return an honest outcome.
    STORAGE_PART_TOO_SMALL: () => Promise.resolve(nonReproducible('STORAGE_PART_TOO_SMALL')),
    STORAGE_TIMEOUT: () => Promise.resolve(nonReproducible('STORAGE_TIMEOUT')),
  }
}

/**
 * Builds the full registry mapping every shipped error code to a deterministic
 * trigger. Reproducible triggers throw a real `StorageException`; the two
 * non-reproducible codes resolve to an explanatory outcome. The return annotation
 * enforces that every shipped code is present.
 *
 * @param deps - The collaborators the triggers drive.
 * @returns A total map from error code to its trigger.
 */
export function buildTriggerRegistry(deps: TriggerDeps): Record<StorageErrorCode, Trigger> {
  const { storage, signedUrls, scoped, connection } = deps
  return {
    ...guardTriggers(storage),
    ...pipelineTriggers(storage),
    ...signedTriggers(signedUrls),
    ...scopedTriggers(scoped, connection),
    ...staticTriggers(),
  }
}
