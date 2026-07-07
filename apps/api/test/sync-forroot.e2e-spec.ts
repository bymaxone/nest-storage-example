/**
 * E2E: sync forRoot boot + raw-client versioning against a real MinIO.
 *
 * Two proofs on one container. First, `BymaxStorageModule.forRoot(inlineOptions)`
 * (the synchronous boot path) is compiled through `@nestjs/testing` and performs a
 * real upload + head round-trip, proving the sync configuration path works
 * end to end (the forRootAsync path is covered elsewhere). Second, the running app
 * serves `GET /system/versioning`, which reaches the raw `S3Client` token to read
 * per-bucket versioning status and carries the abstraction-loss trade-off note.
 *
 * @module test/sync-forroot.e2e-spec
 */
import 'reflect-metadata'
import request from 'supertest'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { BymaxStorageModule, StorageService } from '@bymax-one/nest-storage'
import {
  MINIO_CREDENTIAL,
  startMinioContainer,
  type StartedMinio,
} from './helpers/minio-container.js'
import { createTestApp } from './helpers/test-app.js'

/** Boot window covering a cold image pull plus app init. */
const BOOT_TIMEOUT_MS = 200_000

describe('sync forRoot boot + raw-client versioning (e2e)', () => {
  let minio: StartedMinio
  let app: INestApplication

  beforeAll(async () => {
    minio = await startMinioContainer()
    const created = await createTestApp(minio.endpoint)
    app = created.app
  }, BOOT_TIMEOUT_MS)

  afterAll(async () => {
    if (app !== undefined) {
      await app.close()
    }
    if (minio !== undefined) {
      await minio.container.stop()
    }
  })

  it('boots via synchronous forRoot and performs an upload/head round-trip', async () => {
    /*
     * Scenario: the module is configured with inline options via forRoot.
     * Rule it protects: the synchronous boot path wires the same facades as
     * forRootAsync and round-trips a real object.
     */
    const moduleRef = await Test.createTestingModule({
      imports: [
        BymaxStorageModule.forRoot({
          endpoint: minio.endpoint,
          region: 'us-east-1',
          bucket: 'vault',
          credentials: { accessKeyId: MINIO_CREDENTIAL, secretAccessKey: MINIO_CREDENTIAL },
          forcePathStyle: true,
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
        }),
      ],
    }).compile()
    const storage = moduleRef.get(StorageService)
    const body = Buffer.from('sync boot round-trip')
    await storage.upload({
      key: 'sync-boot/probe.txt',
      body,
      contentType: 'text/plain',
      size: body.byteLength,
    })
    const metadata = await storage.head('sync-boot/probe.txt')
    expect(metadata.size).toBe(body.byteLength)
    await moduleRef.close()
  })

  it('reports per-bucket versioning status via the raw client with the trade-off note', async () => {
    /*
     * Scenario: the versioning endpoint reads status through the raw S3Client token.
     * Rule it protects: all three buckets report a status and the abstraction-loss
     * note is present (the status value itself is provider/setup dependent).
     */
    const res = await request(app.getHttpServer()).get('/system/versioning').expect(200)
    expect(res.body.buckets).toHaveLength(3)
    for (const entry of res.body.buckets) {
      expect(['Enabled', 'Suspended', 'Unversioned']).toContain(entry.status)
    }
    expect(res.body.tradeOffNote).toContain('raw S3Client')
  })
})
