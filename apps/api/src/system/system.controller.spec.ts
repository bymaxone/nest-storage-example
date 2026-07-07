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
