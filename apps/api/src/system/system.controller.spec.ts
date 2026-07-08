/**
 * Unit: SystemController - redacted config + provider-recipe introspection.
 *
 * Constructs the controller directly with a mocked options token and covers the
 * redacted config response (secret never serialized), and the six-recipe render
 * (expected providers, non-empty quirks, and no sample secret leaked).
 *
 * @module system/system.controller.spec
 */
import type { IFileScanner } from '@bymax-one/nest-storage'
import { SystemController } from './system.controller.js'
import type { RedactableStorageOptions } from './config-redactor.js'

/** A scanner stub whose class name proves the config renders the impl by name. */
class DemoScanner implements IFileScanner {
  scan(): ReturnType<IFileScanner['scan']> {
    return Promise.resolve({ status: 'clean', engine: 'demo' })
  }
}

/** Options token value with a planted secret and a live scanner to prove rendering. */
const options = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  bucket: 'vault',
  credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'planted-secret-9876' },
  scanner: { impl: new DemoScanner(), mode: 'post-upload', rejectOnUnknown: true },
} as RedactableStorageOptions

describe('SystemController (unit)', () => {
  const controller = new SystemController(options)

  describe('config', () => {
    it('returns the resolved options with credentials redacted', () => {
      /*
       * Scenario: read the resolved module options via the token.
       * Rule it protects: the access key id is masked, the secret is redacted, and
       * the raw secret never appears in the serialized response (proves token
       * injection + redaction).
       */
      const result = controller.config()

      expect(result.credentials?.accessKeyId).toBe('mini******')
      expect(result.credentials?.secretAccessKey).toBe('[redacted]')
      expect(JSON.stringify(result)).not.toContain('planted-secret-9876')
      // The live scanner is surfaced by name with its resolved mode and reject flag.
      expect(result.scanner).toEqual({
        impl: 'DemoScanner',
        mode: 'post-upload',
        rejectOnUnknown: true,
      })
    })
  })

  describe('recipes', () => {
    it('renders all six providers, each with non-empty quirks', () => {
      /*
       * Scenario: read the provider-recipe catalogue.
       * Rule it protects: exactly the six supported providers are rendered, each
       * carrying at least one documented quirk note.
       */
      const recipes = controller.recipes()

      expect(recipes.map((recipe) => recipe.provider)).toEqual([
        'awsS3',
        'digitalOceanSpaces',
        'cloudflareR2',
        'backblazeB2',
        'minio',
        'wasabi',
      ])
      expect(recipes.every((recipe) => recipe.quirks.length > 0)).toBe(true)
    })

    it('pins the derived options and quirk notes for every provider recipe', () => {
      /*
       * Scenario: each recipe is rendered from its sample args.
       * Rule it protects: the provider-derived endpoint, region, bucket and public
       * base URL and the exact quirk notes are pinned, so a mutant that blanks any
       * recipe argument or quirk string is caught.
       */
      const byProvider = new Map(controller.recipes().map((recipe) => [recipe.provider, recipe]))
      const expected: Record<
        string,
        {
          endpoint: string
          region: string
          bucket: string
          publicBaseUrl: string
          quirks: string[]
        }
      > = {
        awsS3: {
          endpoint: 'https://s3.us-east-1.amazonaws.com',
          region: 'us-east-1',
          bucket: 'vault',
          publicBaseUrl: 'https://vault.s3.us-east-1.amazonaws.com',
          quirks: [
            'Keeps the SDK default checksum behavior (WHEN_SUPPORTED, CRC32 integrity headers).',
            'ACLs are disabled on modern buckets (Object Ownership = Bucket owner enforced); a public-read ACL returns HTTP 400. Prefer a bucket policy, CDN, or signed URLs.',
          ],
        },
        digitalOceanSpaces: {
          endpoint: 'https://nyc3.digitaloceanspaces.com',
          region: 'nyc3',
          bucket: 'vault',
          publicBaseUrl: 'https://vault.nyc3.digitaloceanspaces.com',
          quirks: [
            'Sets checksum mode to WHEN_REQUIRED (non-AWS providers reject the SDK default CRC32 headers).',
            'Virtual-hosted addressing with public delivery via the Spaces CDN host.',
          ],
        },
        cloudflareR2: {
          endpoint: 'https://account-id.r2.cloudflarestorage.com',
          region: 'auto',
          bucket: 'vault',
          publicBaseUrl: 'https://cdn.example.com',
          quirks: [
            'Region is always "auto".',
            'Sets checksum mode to WHEN_REQUIRED.',
            'Public reads require a custom domain (publicBaseUrl); the S3 API host does not serve public objects.',
            'ACLs are a no-op on R2.',
          ],
        },
        backblazeB2: {
          endpoint: 'https://s3.us-west-002.backblazeb2.com',
          region: 'us-west-002',
          bucket: 'vault',
          publicBaseUrl: 'https://vault.s3.us-west-002.backblazeb2.com',
          quirks: [
            'Sets checksum mode to WHEN_REQUIRED.',
            'Endpoint host varies by region cluster; virtual-hosted addressing matches publicBaseUrl.',
          ],
        },
        minio: {
          endpoint: 'http://localhost:9000',
          region: 'us-east-1',
          bucket: 'vault',
          publicBaseUrl: 'http://localhost:9000/vault',
          quirks: [
            'Path-style addressing (forcePathStyle = true).',
            'Sets checksum mode to WHEN_REQUIRED (MinIO rejects the SDK default CRC32 headers).',
          ],
        },
        wasabi: {
          endpoint: 'https://s3.us-east-1.wasabisys.com',
          region: 'us-east-1',
          bucket: 'vault',
          publicBaseUrl: 'https://vault.s3.us-east-1.wasabisys.com',
          quirks: [
            'Sets checksum mode to WHEN_REQUIRED.',
            'Virtual-hosted addressing (Hot Cloud Storage).',
          ],
        },
      }
      for (const [provider, want] of Object.entries(expected)) {
        const recipe = byProvider.get(provider)
        expect(recipe?.options.endpoint).toBe(want.endpoint)
        expect(recipe?.options.region).toBe(want.region)
        expect(recipe?.options.bucket).toBe(want.bucket)
        expect(recipe?.options.publicBaseUrl).toBe(want.publicBaseUrl)
        expect(recipe?.quirks).toEqual(want.quirks)
      }
    })

    it('redacts the sample credentials in every rendered recipe', () => {
      /*
       * Scenario: the recipes are built from representative sample credentials.
       * Rule it protects: no sample secret survives serialization and each recipe
       * reports the redaction marker for its secret access key.
       */
      const recipes = controller.recipes()

      expect(JSON.stringify(recipes)).not.toContain('sample-secret-value')
      expect(
        recipes.every((recipe) => recipe.options.credentials?.secretAccessKey === '[redacted]'),
      ).toBe(true)
    })
  })
})
