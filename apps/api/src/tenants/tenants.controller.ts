/**
 * @fileoverview Tenant endpoints. Thin controller: it validates the tenant slug
 * (route param), the upload body, and the listing query with `ZodValidationPipe`,
 * then delegates to `TenantsService`. `POST /tenants/:t/upload` stores a text
 * body under the composed tenant key; `GET /tenants/:t/objects` lists strictly
 * within the tenant prefix; `DELETE /tenants/:t/objects` clears only that tenant.
 * Tenant isolation is application-level prefix composition under the single
 * module `keyPrefix`, not a library-enforced boundary (spec §11.1, §12).
 * @layer api/tenants
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import {
  TenantsService,
  type TenantClearView,
  type TenantListView,
  type TenantUploadView,
} from './tenants.service.js'
import { tenantSlugSchema } from './dto/tenant-params.dto.js'
import { tenantUploadBodySchema, type TenantUploadBody } from './dto/tenant-upload.dto.js'
import { tenantListQuerySchema, type TenantListQuery } from './dto/tenant-list.dto.js'

/** Tenant-scoped object operations: all `/tenants/:t/*` routes. */
@Controller('tenants')
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  /**
   * POST /tenants/:t/upload - store a text body under the composed tenant key.
   *
   * @param tenant - The validated tenant slug.
   * @param body - The validated upload body.
   * @returns The upload result with the app key, full composed key, and honest note.
   */
  @Post(':t/upload')
  @HttpCode(201)
  upload(
    @Param('t', new ZodValidationPipe(tenantSlugSchema)) tenant: string,
    @Body(new ZodValidationPipe(tenantUploadBodySchema)) body: TenantUploadBody,
  ): Promise<TenantUploadView> {
    return this.service.upload(tenant, body)
  }

  /**
   * GET /tenants/:t/objects - list one page of a tenant's objects.
   *
   * @param tenant - The validated tenant slug.
   * @param query - The validated listing query.
   * @returns One page of tenant objects scoped to the tenant prefix.
   */
  @Get(':t/objects')
  list(
    @Param('t', new ZodValidationPipe(tenantSlugSchema)) tenant: string,
    @Query(new ZodValidationPipe(tenantListQuerySchema)) query: TenantListQuery,
  ): Promise<TenantListView> {
    return this.service.list(tenant, query)
  }

  /**
   * DELETE /tenants/:t/objects - clear only this tenant's objects.
   *
   * @param tenant - The validated tenant slug.
   * @returns The deleted/failed counts proving the clear stayed inside the prefix.
   */
  @Delete(':t/objects')
  clear(
    @Param('t', new ZodValidationPipe(tenantSlugSchema)) tenant: string,
  ): Promise<TenantClearView> {
    return this.service.clear(tenant)
  }
}
