'use strict'

/**
 * Jest configuration for the API **unit** tier.
 *
 * Separate from `jest-e2e.config.mjs` (which boots a real MinIO via
 * Testcontainers/compose and lives under `test/`). Unit specs are co-located
 * with their subject as `src/**\/*.spec.ts` and construct classes directly — no
 * Nest DI container, no network — so the suite is Docker-free and fast.
 *
 * The unit tsconfig (`tsconfig.spec.json`) compiles with `emitDecoratorMetadata`
 * OFF: a NestJS class compiled with that flag emits a
 * `__metadata("design:paramtypes", [… ? _a : Object])` ternary whose `: Object`
 * arm is an unreachable phantom branch that `ignoreCoverageForAllDecorators`
 * alone cannot suppress. Direct construction never needs that reflection
 * metadata, so the 100% branch gate stays reachable. The e2e config keeps
 * metadata ON.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/../tsconfig.spec.json',
        // Suppresses the coverage false-positive for the `__decorate(...)` wrappers.
        ignoreCoverageForAllDecorators: true,
      },
    ],
  },
  // NodeNext source imports siblings as `./foo.js`; map the `.js` specifier back
  // to the `.ts` source so Jest resolves the file it actually transpiles.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Coverage scope: every executable source file under `src`, minus
  // non-executable glue only. `*.module.ts` are pure DI wiring exercised by the
  // e2e boot; `main.ts` is the process entrypoint (a `listen()` call proven by
  // the e2e boot, not unit); `*.d.ts` are type-only declarations. Everything
  // else - including `app.factory.ts` (unit-proven via a NestFactory spy) - is
  // in scope so the 100% gate stays meaningful rather than gamed.
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!**/*.module.ts', '!main.ts', '!**/*.d.ts'],
  coverageThreshold: {
    global: { branches: 100, functions: 100, lines: 100, statements: 100 },
  },
  coverageReporters: ['text', 'text-summary', 'json-summary'],
  coverageDirectory: '../coverage/api',
  clearMocks: true,
  restoreMocks: true,
  testEnvironment: 'node',
  // Bound the worker pool: each worker reloads the locally-linked
  // `@bymax-one/nest-storage` (`file:` dependency) and its own ts-jest
  // transpiler, so an unbounded pool multiplies that footprint and can exhaust
  // memory on small runners. `'50%'` keeps the suite fast on dev machines while
  // staying safe (one worker on a 2-core runner).
  maxWorkers: '50%',
}
