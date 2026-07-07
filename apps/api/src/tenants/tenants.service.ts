/**
 * @fileoverview Tenant-scoped object operations. HONEST DESIGN: the library
 * applies exactly ONE global `keyPrefix` per module instance; this service does
 * NOT get library-enforced tenant isolation. Instead it composes an application
 * level prefix inside that single instance — every key is
 * `{tenant}/{category}/{uuid}.{ext}`, which the library then stores under
 * `{keyPrefix}/{tenant}/{category}/{uuid}.{ext}`. Isolation is therefore a
 * property of disciplined prefix composition here, not a boundary the library
 * guarantees; the responses restate this so the demo never overclaims.
 *
 * Clearing a tenant lists strictly within `{tenant}/` and deletes only those
 * keys, page by page, so it can never escape into a sibling tenant's prefix.
 * @layer api/tenants
 */
import { Inject, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
// StorageService must be a value import (not `import type`): NestJS resolves the
// constructor dependency from the emitted `design:paramtypes` metadata, which
// requires the class to exist at runtime. A type-only import is elided and DI fails.
import { BYMAX_STORAGE_OPTIONS, StorageService } from '@bymax-one/nest-storage'
import type { ListedObject, UploadResult } from '@bymax-one/nest-storage'
import type { TenantUploadBody } from './dto/tenant-upload.dto.js'
import type { TenantListQuery } from './dto/tenant-list.dto.js'

/** Narrow view of the resolved options this service reads (the global prefix). */
export interface TenantPrefixOptions {
  /** The single global key prefix the module instance applies to every key. */
  keyPrefix: string
}

/** The honest framing repeated on every tenant response. */
const APP_LEVEL_NOTE =
  'Tenant isolation here is application-level key composition, not a library-enforced boundary: the module applies ONE global keyPrefix per instance and every key is composed as {keyPrefix}/{tenant}/{category}/{uuid}. Cross-tenant safety comes from this service scoping every read, list, and clear to the {tenant}/ prefix.'

/** Default key suffix when the caller does not supply an extension. */
const DEFAULT_EXTENSION = 'txt'

/** Content type used for the stored tenant text (allowed by the MIME whitelist). */
const TENANT_CONTENT_TYPE = 'text/plain'

/** A tenant object rendered with both its app key and full composed key. */
export interface TenantObjectView {
  /** The application key (tenant prefix included, global prefix stripped). */
  key: string
  /** The full key as stored by the provider, including the global keyPrefix. */
  fullKey: string
  /** Object size in bytes. */
  size: number
  /** Object ETag. */
  etag: string
}

/** Result of a tenant upload, exposing the full key composition. */
export interface TenantUploadView {
  /** The tenant the object was stored under. */
  tenant: string
  /** The application key (tenant prefix included). */
  key: string
  /** The full key as stored by the provider, including the global keyPrefix. */
  fullKey: string
  /** The library upload result. */
  result: UploadResult
  /** The honest app-level-prefix framing. */
  note: string
}

/** Result of a tenant listing. */
export interface TenantListView {
  /** The tenant whose objects were listed. */
  tenant: string
  /** The prefix the listing was scoped to (`{tenant}/` or `{tenant}/{category}/`). */
  prefix: string
  /** The objects found under the tenant prefix. */
  objects: TenantObjectView[]
  /** Cursor for the next page (absent on the last page). */
  nextCursor?: string
  /** The honest app-level-prefix framing. */
  note: string
}

/** Result of clearing a tenant, with per-outcome counts. */
export interface TenantClearView {
  /** The tenant that was cleared. */
  tenant: string
  /** The prefix the clear was scoped to (`{tenant}/`). */
  prefix: string
  /** Number of objects deleted. */
  deleted: number
  /** Number of objects the provider failed to delete. */
  failed: number
  /** The keys that failed to delete, with the provider reason. */
  failures: { key: string; error: string }[]
  /** The honest app-level-prefix framing. */
  note: string
}

/** Composes and operates on tenant-scoped keys under the single instance prefix. */
@Injectable()
export class TenantsService {
  constructor(
    private readonly storage: StorageService,
    @Inject(BYMAX_STORAGE_OPTIONS) private readonly options: TenantPrefixOptions,
  ) {}

  /**
   * Uploads a text body under `{tenant}/{category}/{uuid}.{ext}` through the
   * single module instance. The stored object therefore lives at
   * `{keyPrefix}/{tenant}/...`; the response renders both keys so the layering
   * is visible.
   *
   * @param tenant - The validated tenant slug.
   * @param body - The validated upload body (category, content, optional extension).
   * @returns The upload result plus the app key, full key, and honest note.
   * @throws {StorageException} Propagates any library error through the global filter.
   */
  async upload(tenant: string, body: TenantUploadBody): Promise<TenantUploadView> {
    const extension = body.extension ?? DEFAULT_EXTENSION
    const key = `${tenant}/${body.category}/${randomUUID()}.${extension}`
    const buffer = Buffer.from(body.content, 'utf8')
    const result = await this.storage.upload({
      key,
      body: buffer,
      contentType: TENANT_CONTENT_TYPE,
      size: buffer.byteLength,
    })
    return { tenant, key, fullKey: this.composeFullKey(key), result, note: APP_LEVEL_NOTE }
  }

  /**
   * Lists one page of a tenant's objects, scoped strictly to the `{tenant}/`
   * prefix (optionally narrowed to a category). A validated tenant slug can
   * never widen this prefix, so the listing never reveals another tenant.
   *
   * @param tenant - The validated tenant slug.
   * @param query - The validated listing query (optional category, cursor, maxKeys).
   * @returns One page of tenant objects with the next cursor and honest note.
   * @throws {StorageException} Propagates any library error through the global filter.
   */
  async list(tenant: string, query: TenantListQuery): Promise<TenantListView> {
    const prefix = this.tenantPrefix(tenant, query.category)
    const result = await this.storage.list({
      prefix,
      ...(query.maxKeys !== undefined ? { maxKeys: query.maxKeys } : {}),
      ...(query.cursor !== undefined ? { continuationToken: query.cursor } : {}),
    })
    return {
      tenant,
      prefix,
      objects: result.objects.map((object) => this.toObjectView(object)),
      ...(result.nextContinuationToken !== undefined
        ? { nextCursor: result.nextContinuationToken }
        : {}),
      note: APP_LEVEL_NOTE,
    }
  }

  /**
   * Clears a tenant by paging its `{tenant}/` listing and deleting only the keys
   * returned for that prefix, page by page. The delete set is always the exact
   * keys the scoped listing produced, so clearing one tenant provably cannot
   * touch another tenant's objects.
   *
   * @param tenant - The validated tenant slug.
   * @returns The deleted/failed counts, any per-key failures, and the honest note.
   * @throws {StorageException} Propagates any library error through the global filter.
   */
  async clear(tenant: string): Promise<TenantClearView> {
    const prefix = this.tenantPrefix(tenant)
    let cursor: string | undefined
    let deleted = 0
    const failures: { key: string; error: string }[] = []
    do {
      const page = await this.storage.list({
        prefix,
        ...(cursor !== undefined ? { continuationToken: cursor } : {}),
      })
      const keys = page.objects.map((object) => object.key)
      if (keys.length > 0) {
        const outcome = await this.storage.deleteMany(keys)
        deleted += outcome.deleted.length
        failures.push(...outcome.failed)
      }
      cursor = page.nextContinuationToken
    } while (cursor !== undefined)
    return { tenant, prefix, deleted, failed: failures.length, failures, note: APP_LEVEL_NOTE }
  }

  /** Builds the tenant (optionally category-narrowed) listing prefix with a trailing slash. */
  private tenantPrefix(tenant: string, category?: string): string {
    return category !== undefined ? `${tenant}/${category}/` : `${tenant}/`
  }

  /** Maps a listed object onto the view with both app and full composed keys. */
  private toObjectView(object: ListedObject): TenantObjectView {
    return {
      key: object.key,
      fullKey: this.composeFullKey(object.key),
      size: object.size,
      etag: object.etag,
    }
  }

  /** Prepends the single global key prefix to an app key for display. */
  private composeFullKey(key: string): string {
    const prefix = this.options.keyPrefix
    return prefix ? `${prefix}/${key}` : key
  }
}
