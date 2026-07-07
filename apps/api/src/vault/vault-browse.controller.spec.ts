/**
 * Unit: VaultBrowseController - HTTP layer for vault collection routes.
 *
 * Mocks `VaultService` and an injectable `ConfigService` stub. Covers: list
 * delegation (ListResponse pass-through), bulk-delete delegation, copy
 * (both same-bucket and archive modes), and route metadata (verb + path).
 *
 * @module vault/vault-browse.controller.spec
 */
import 'reflect-metadata'
import { jest } from '@jest/globals'
import { RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { StorageException } from '@bymax-one/nest-storage'
import type { DeleteManyResult } from '@bymax-one/nest-storage'
import type { ConfigService } from '@nestjs/config'
import { VaultBrowseController } from './vault-browse.controller.js'
import { VaultService } from './vault.service.js'
import type { ListResponse, CopyResponse } from './vault.service.js'
import type { Env } from '../config/env.schema.js'

/** NestJS route-metadata keys. */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

/**
 * Builds the controller with mocked service and config.
 *
 * @returns The controller plus mock functions.
 */
function setup() {
  const list = jest.fn<VaultService['list']>()
  const deleteMany = jest.fn<VaultService['deleteMany']>()
  const copy = jest.fn<VaultService['copy']>()
  const service = { list, deleteMany, copy } as unknown as VaultService

  const env: Env = {
    NODE_ENV: 'test',
    PORT: 3001,
    WEB_ORIGIN: 'http://localhost:3000',
    STORAGE_ENDPOINT: 'http://localhost:9000',
    STORAGE_REGION: 'us-east-1',
    STORAGE_BUCKET: 'vault',
    STORAGE_ARCHIVE_BUCKET: 'vault-archive',
    STORAGE_VERSIONED_BUCKET: 'vault-versioned',
    STORAGE_ACCESS_KEY_ID: 'minioadmin',
    STORAGE_SECRET_ACCESS_KEY: 'minioadmin',
    STORAGE_FORCE_PATH_STYLE: true,
    STORAGE_PUBLIC_BASE_URL: 'http://localhost:9000/vault',
    STORAGE_CDN_BASE_URL: '',
    STORAGE_KEY_PREFIX: 'storage-example',
    STORAGE_SSE: '',
    STORAGE_CHECKSUM_MODE: 'WHEN_REQUIRED',
    STORAGE_MAX_TTL_SECONDS: 3600,
    STORAGE_MULTIPART_THRESHOLD: 5_242_880,
    SCANNER_MODE: 'pre-upload',
    SCANNER_REJECT_ON_UNKNOWN: false,
    UPLOAD_MAX_SIZE_BYTES: 26_214_400,
  }

  const config = {
    get: jest.fn(() => env),
  } as unknown as ConfigService<{ env: Env }, true>

  const controller = new VaultBrowseController(service, config)
  return { controller, list, deleteMany, copy, env, config }
}

describe('VaultBrowseController (unit)', () => {
  describe('list', () => {
    it('delegates to the service and returns the listing result', async () => {
      /*
       * Scenario: list call with all query params; result is passed through.
       * Rule it protects: the controller forwards the query and returns the
       * ListResponse without modification.
       */
      const { controller, list } = setup()
      const response: ListResponse = {
        objects: [],
        commonPrefixes: ['avatars/'],
        isTruncated: false,
      }
      list.mockResolvedValue(response)

      const result = await controller.list({ prefix: 'avatars/', maxKeys: 10, delimiter: '/' })
      expect(list).toHaveBeenCalledWith({ prefix: 'avatars/', maxKeys: 10, delimiter: '/' })
      expect(result).toBe(response)
    })

    it('propagates StorageException from the service', async () => {
      /*
       * Scenario: the library rejects the list call; the exception propagates.
       * Rule it protects: provider errors reach the global filter unchanged.
       */
      const { controller, list } = setup()
      list.mockRejectedValue(new StorageException('STORAGE_PROVIDER_ERROR'))

      await expect(controller.list({ maxKeys: 50 })).rejects.toBeInstanceOf(StorageException)
    })
  })

  describe('bulkDelete', () => {
    it('delegates to the service and returns the verbatim result', async () => {
      /*
       * Scenario: bulk delete of three keys; the partial-failure report is
       * returned unchanged.
       * Rule it protects: the controller does not transform the library result.
       */
      const { controller, deleteMany } = setup()
      const report: DeleteManyResult = {
        deleted: ['k1', 'k2'],
        failed: [{ key: 'k3', error: 'NoSuchKey' }],
      }
      deleteMany.mockResolvedValue(report)

      const result = await controller.bulkDelete({ keys: ['k1', 'k2', 'k3'] })
      expect(deleteMany).toHaveBeenCalledWith(['k1', 'k2', 'k3'])
      expect(result).toBe(report)
    })

    it('propagates StorageException on a batch failure', async () => {
      /*
       * Scenario: the entire batch fails at the provider level.
       * Rule it protects: batch-level errors reach the global filter.
       */
      const { controller, deleteMany } = setup()
      deleteMany.mockRejectedValue(new StorageException('STORAGE_PROVIDER_ERROR'))

      await expect(controller.bulkDelete({ keys: ['k1'] })).rejects.toBeInstanceOf(StorageException)
    })
  })

  describe('copy', () => {
    it('passes archive and default bucket from env to the service (same-bucket copy)', async () => {
      /*
       * Scenario: same-bucket copy; config bucket values are forwarded to the service.
       * Rule it protects: the controller reads bucket names from env, not hardcodes them.
       */
      const { controller, copy } = setup()
      const response: CopyResponse = {
        etag: '"e"',
        source: 'src.png',
        destination: 'dst.png',
        bucket: 'vault',
      }
      copy.mockResolvedValue(response)

      const result = await controller.copy({
        sourceKey: 'src.png',
        destinationKey: 'dst.png',
        destination: 'same',
      })

      expect(copy).toHaveBeenCalledWith(
        { sourceKey: 'src.png', destinationKey: 'dst.png', destination: 'same' },
        'vault-archive',
        'vault',
      )
      expect(result).toBe(response)
    })

    it('passes archive bucket for an archive-destination copy', async () => {
      /*
       * Scenario: cross-bucket copy to vault-archive.
       * Rule it protects: the archive bucket name from env is forwarded correctly.
       */
      const { controller, copy } = setup()
      const response: CopyResponse = {
        etag: '"a"',
        source: 'src.png',
        destination: 'archive/src.png',
        bucket: 'vault-archive',
      }
      copy.mockResolvedValue(response)

      const result = await controller.copy({
        sourceKey: 'src.png',
        destinationKey: 'archive/src.png',
        destination: 'archive',
      })

      expect(copy).toHaveBeenCalledWith(
        expect.objectContaining({ destination: 'archive' }),
        'vault-archive',
        'vault',
      )
      expect(result.bucket).toBe('vault-archive')
    })

    it('forwards deleteSource=true to the service', async () => {
      /*
       * Scenario: caller includes deleteSource=true; the option is forwarded so the
       * controller's conditional spread path (deleteSource !== undefined) is covered.
       * Rule it protects: the rename pattern (copy + delete source) is wired end-to-end.
       */
      const { controller, copy } = setup()
      const response: CopyResponse = {
        etag: '"r"',
        source: 'old.png',
        destination: 'new.png',
        bucket: 'vault',
      }
      copy.mockResolvedValue(response)

      await controller.copy({
        sourceKey: 'old.png',
        destinationKey: 'new.png',
        destination: 'same',
        deleteSource: true,
      })

      expect(copy).toHaveBeenCalledWith(
        expect.objectContaining({ deleteSource: true }),
        'vault-archive',
        'vault',
      )
    })

    it('propagates STORAGE_OBJECT_NOT_FOUND when the source is absent', async () => {
      /*
       * Scenario: the exists() precheck in the service throws.
       * Rule it protects: not-found errors reach the global filter.
       */
      const { controller, copy } = setup()
      copy.mockRejectedValue(new StorageException('STORAGE_OBJECT_NOT_FOUND'))

      await expect(
        controller.copy({ sourceKey: 'ghost.png', destinationKey: 'dst.png', destination: 'same' }),
      ).rejects.toBeInstanceOf(StorageException)
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('declares GET on the list handler', () => {
      /*
       * Scenario: inspect verb for the listing route.
       * Rule it protects: the route is GET at the root vault path.
       */
      const handler: keyof VaultBrowseController = 'list'
      const fn = VaultBrowseController.prototype[handler]
      expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(RequestMethod.GET)
    })

    it('declares POST bulk-delete on the bulkDelete handler', () => {
      /*
       * Scenario: inspect verb and path for the bulk-delete route.
       * Rule it protects: the route is POST + 'bulk-delete'.
       */
      const handler: keyof VaultBrowseController = 'bulkDelete'
      const fn = VaultBrowseController.prototype[handler]
      expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(RequestMethod.POST)
      expect(reflector.get<string>(PATH_METADATA, fn)).toBe('bulk-delete')
    })

    it('declares POST copy on the copy handler', () => {
      /*
       * Scenario: inspect verb and path for the copy route.
       * Rule it protects: the route is POST + 'copy'.
       */
      const handler: keyof VaultBrowseController = 'copy'
      const fn = VaultBrowseController.prototype[handler]
      expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(RequestMethod.POST)
      expect(reflector.get<string>(PATH_METADATA, fn)).toBe('copy')
    })
  })
})
