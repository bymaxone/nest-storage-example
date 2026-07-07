/**
 * E2E: application bootstrap smoke.
 *
 * Boots the real Nest application through `createApp()` and asserts the root
 * identity route responds with the documented shape, then closes cleanly. This
 * proves the `createApp` seam wires a listenable app without spawning a process.
 * Health and the storage surface are asserted by their own e2e specs as they
 * land.
 *
 * @module test/boot.e2e-spec
 */
import 'reflect-metadata'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { createApp } from '../src/app.factory.js'

describe('application bootstrap (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createApp()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET / returns the service identity shape with HTTP 200', async () => {
    /*
     * Scenario: a fresh boot receives a request on the root route.
     * Rule it protects: the app initialises and serves `{ name, version, docs }`,
     * confirming the createApp seam produces a working HTTP application.
     */
    const response = await request(app.getHttpServer()).get('/')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      name: 'nest-storage-example',
      version: '0.0.0',
      docs: '/system/recipes',
    })
  })
})
