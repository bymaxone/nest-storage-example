/**
 * Unit: AppController - the root service-identity surface.
 *
 * Constructs the controller directly (no Nest DI) and pins both the returned
 * body shape and the route metadata so a mutant on the literals or the HTTP
 * verb is caught.
 *
 * @module app.controller.spec
 */
import 'reflect-metadata'
import { RequestMethod } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AppController } from './app.controller.js'

/** NestJS route-metadata keys (mirror @nestjs/common/constants, which has no NodeNext type subpath). */
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'

describe('AppController (unit)', () => {
  describe('root', () => {
    it('returns the service identity with a name, version, and docs pointer', () => {
      /*
       * Scenario: a liveness probe hits the root route.
       * Rule it protects: the identity body carries a non-empty name, a version
       * string, and a docs path so a consumer can discover the API surface.
       */
      const controller = new AppController()

      const identity = controller.root()

      expect(identity).toEqual({
        name: 'nest-storage-example',
        version: '0.0.0',
        docs: '/system/recipes',
      })
    })
  })

  describe('route metadata', () => {
    const reflector = new Reflector()

    it('mounts the controller at the root path', () => {
      /*
       * Scenario: inspect the argument-less @Controller base path.
       * Rule it protects: an empty @Controller resolves to the `/` base.
       */
      expect(reflector.get<string>(PATH_METADATA, AppController)).toBe('/')
    })

    it('declares GET / for the root handler', () => {
      /*
       * Scenario: inspect the route's verb and sub-path.
       * Rule it protects: the GET verb and the empty sub-path are pinned so a
       * method or StringLiteral mutant is caught.
       */
      const handler: keyof AppController = 'root'
      const fn = AppController.prototype[handler]
      expect(reflector.get<number>(METHOD_METADATA, fn)).toBe(RequestMethod.GET)
      expect(reflector.get<string>(PATH_METADATA, fn)).toBe('/')
    })
  })
})
