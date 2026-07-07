/**
 * Jest configuration for the API E2E tier.
 *
 * ESM-native: specs and the app source are pure ESM (`"type": "module"`,
 * `NodeNext`), so Jest runs under `node --experimental-vm-modules` and ts-jest
 * transpiles every `.ts` to ESM (`useESM: true`). The `moduleNameMapper`
 * rewrites the explicit `.js` import specifiers the source uses (NodeNext
 * requires them) back to the on-disk `.ts` files Jest resolves.
 *
 * This tier boots the real Nest application (`createApp`) and probes it over
 * supertest against the local MinIO stack. It deliberately carries NO coverage
 * gate and NO mutation testing — those quality gates belong to the library
 * itself and to the unit tier, not to this reference app's smoke.
 *
 * @type {import('jest').Config}
 */
export default {
  rootDir: 'test',
  testMatch: ['**/*.e2e-spec.ts'],
  testEnvironment: 'node',
  testTimeout: 60_000,
  moduleFileExtensions: ['ts', 'js', 'mjs', 'cjs', 'json'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  // NodeNext source imports siblings as `./foo.js`; map the `.js` specifier back
  // to the `.ts` source so Jest resolves the file it actually transpiles.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  clearMocks: true,
  restoreMocks: true,
  // The Nest app and the AWS SDK keep native handles that async_hooks cannot
  // always drain; force a clean exit so a green run never prints a worker
  // warning. Scoped to this suite only.
  forceExit: true,
}
