/**
 * @fileoverview Vitest configuration for the storage dashboard web unit tier.
 *
 * jsdom environment + the React plugin so client modules (and the
 * @bymax-one/nest-storage/shared browser import) resolve exactly as they do in
 * the Next.js bundle. The `@` path alias mirrors tsconfig.json. v8 coverage
 * gated at 100% over lib/, hooks/, and components/ — vendored shadcn primitives
 * and Next.js route shells are excluded.
 *
 * @module vitest.config
 */
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['{app,components,lib,hooks}/**/*.{test,spec}.{ts,tsx}'],
    maxWorkers: '50%',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'html'],
      include: ['lib/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
      exclude: [
        'components/ui/**',
        // Compile-time-only proof that the browser-safe `./shared` subpath
        // resolves without the library's peers; it has no runtime behavior.
        'lib/storage-shared-probe.ts',
        '**/*.{test,spec}.{ts,tsx}',
        '**/index.ts',
        '**/types.ts',
        '**/*.types.ts',
        '**/*.d.ts',
      ],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
    },
  },
})
