/**
 * @fileoverview Operational introspection endpoints. `GET /system/config`
 * returns the resolved module options with credentials redacted (proving the
 * options-token injection, spec §11.1). `GET /system/recipes` renders all six
 * provider recipes with representative sample args and honest quirk notes
 * sourced from the library docs (spec §12.6-§12.7), also redacted.
 * @layer api/system
 */
import { Controller, Get, Inject } from '@nestjs/common'
import { BYMAX_STORAGE_OPTIONS, providerRecipes } from '@bymax-one/nest-storage'
import { redactStorageOptions, type RedactableStorageOptions } from './config-redactor.js'

/** One rendered provider recipe: its name, redacted options, and quirk notes. */
export interface RecipeView {
  provider: string
  options: RedactableStorageOptions
  quirks: string[]
}

/** Representative (non-secret) sample credentials used to render the recipes. */
const SAMPLE = { accessKeyId: 'AKIAEXAMPLE1234', secretAccessKey: 'sample-secret-value' } as const

/**
 * Builds the six provider recipes with sample args and documented quirks. The
 * options are redacted so no secret-looking sample value is ever serialized.
 *
 * @returns One redacted, annotated view per supported provider.
 */
function buildRecipeViews(): RecipeView[] {
  const views: RecipeView[] = [
    {
      provider: 'awsS3',
      options: providerRecipes.awsS3({ region: 'us-east-1', bucket: 'vault', ...SAMPLE }),
      quirks: [
        'Keeps the SDK default checksum behavior (WHEN_SUPPORTED, CRC32 integrity headers).',
        'ACLs are disabled on modern buckets (Object Ownership = Bucket owner enforced); a public-read ACL returns HTTP 400. Prefer a bucket policy, CDN, or signed URLs.',
      ],
    },
    {
      provider: 'digitalOceanSpaces',
      options: providerRecipes.digitalOceanSpaces({ region: 'nyc3', bucket: 'vault', ...SAMPLE }),
      quirks: [
        'Sets checksum mode to WHEN_REQUIRED (non-AWS providers reject the SDK default CRC32 headers).',
        'Virtual-hosted addressing with public delivery via the Spaces CDN host.',
      ],
    },
    {
      provider: 'cloudflareR2',
      options: providerRecipes.cloudflareR2({
        accountId: 'account-id',
        bucket: 'vault',
        customDomain: 'https://cdn.example.com',
        ...SAMPLE,
      }),
      quirks: [
        'Region is always "auto".',
        'Sets checksum mode to WHEN_REQUIRED.',
        'Public reads require a custom domain (publicBaseUrl); the S3 API host does not serve public objects.',
        'ACLs are a no-op on R2.',
      ],
    },
    {
      provider: 'backblazeB2',
      options: providerRecipes.backblazeB2({
        region: 'us-west-002',
        bucket: 'vault',
        endpointHost: 's3.us-west-002.backblazeb2.com',
        ...SAMPLE,
      }),
      quirks: [
        'Sets checksum mode to WHEN_REQUIRED.',
        'Endpoint host varies by region cluster; virtual-hosted addressing matches publicBaseUrl.',
      ],
    },
    {
      provider: 'minio',
      options: providerRecipes.minio({
        endpoint: 'http://localhost:9000',
        bucket: 'vault',
        ...SAMPLE,
      }),
      quirks: [
        'Path-style addressing (forcePathStyle = true).',
        'Sets checksum mode to WHEN_REQUIRED (MinIO rejects the SDK default CRC32 headers).',
      ],
    },
    {
      provider: 'wasabi',
      options: providerRecipes.wasabi({ region: 'us-east-1', bucket: 'vault', ...SAMPLE }),
      quirks: [
        'Sets checksum mode to WHEN_REQUIRED.',
        'Virtual-hosted addressing (Hot Cloud Storage).',
      ],
    },
  ]
  return views.map((view) => ({ ...view, options: redactStorageOptions(view.options) }))
}

/** Introspection surface over the resolved module options and provider recipes. */
@Controller('system')
export class SystemController {
  constructor(@Inject(BYMAX_STORAGE_OPTIONS) private readonly options: RedactableStorageOptions) {}

  /**
   * GET /system/config - the resolved module options with credentials redacted.
   *
   * @returns The redacted resolved storage options.
   */
  @Get('config')
  config(): RedactableStorageOptions {
    return redactStorageOptions(this.options)
  }

  /**
   * GET /system/recipes - the six provider recipes with sample args and quirks.
   *
   * @returns One redacted, annotated view per supported provider.
   */
  @Get('recipes')
  recipes(): RecipeView[] {
    return buildRecipeViews()
  }
}
