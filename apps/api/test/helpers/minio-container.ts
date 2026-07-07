/**
 * Testcontainers helper - boots a real MinIO for the E2E tier.
 *
 * The e2e suites start their own MinIO container (isolated from the dev compose)
 * so the presigned round-trips run identically on a developer machine and on a
 * GitHub-hosted runner (both ship a Docker daemon). The three application
 * buckets are created after boot so the app's health probe and the signed flows
 * have somewhere to write.
 *
 * Testcontainers requires a reachable Docker daemon; `start()` rejects loudly
 * when Docker is unreachable rather than silently skipping the real-MinIO
 * coverage.
 *
 * @module test/helpers/minio-container
 */
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers'
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'

/** Image pinned by digest to match the dev compose for reproducible runs. */
const MINIO_IMAGE =
  'minio/minio:latest@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e'

/** The MinIO API port inside the container. */
const MINIO_PORT = 9000

/** Well-known local MinIO factory credential (dev-only). */
export const MINIO_CREDENTIAL = 'minioadmin'

/** The application buckets created on boot (mirrors the compose bootstrap). */
export const MINIO_BUCKETS = ['vault', 'vault-archive', 'vault-versioned'] as const

/** Generous boot window - the first run also pulls the image on a cold machine. */
const STARTUP_TIMEOUT_MS = 180_000

/** A started MinIO container plus its resolved endpoint URL. */
export interface StartedMinio {
  /** The underlying Testcontainers handle; call `.stop()` in afterAll. */
  container: StartedTestContainer
  /** The S3 API endpoint (`http://host:port`) for the app and clients. */
  endpoint: string
}

/**
 * Starts a MinIO container and creates the application buckets.
 *
 * @returns The started container and its resolved S3 endpoint.
 * @throws When the Docker daemon is unreachable or the image cannot start.
 */
export async function startMinioContainer(): Promise<StartedMinio> {
  const container = await new GenericContainer(MINIO_IMAGE)
    .withEnvironment({ MINIO_ROOT_USER: MINIO_CREDENTIAL, MINIO_ROOT_PASSWORD: MINIO_CREDENTIAL })
    .withCommand(['server', '/data'])
    .withExposedPorts(MINIO_PORT)
    .withWaitStrategy(Wait.forHttp('/minio/health/live', MINIO_PORT))
    .withStartupTimeout(STARTUP_TIMEOUT_MS)
    .start()
  const endpoint = `http://${container.getHost()}:${String(container.getMappedPort(MINIO_PORT))}`
  await createBuckets(endpoint)
  return { container, endpoint }
}

/**
 * Creates the application buckets on a freshly booted MinIO.
 *
 * @param endpoint - The MinIO S3 endpoint.
 */
async function createBuckets(endpoint: string): Promise<void> {
  const client = new S3Client({
    endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: MINIO_CREDENTIAL, secretAccessKey: MINIO_CREDENTIAL },
  })
  try {
    for (const bucket of MINIO_BUCKETS) {
      await client.send(new CreateBucketCommand({ Bucket: bucket }))
    }
  } finally {
    client.destroy()
  }
}
