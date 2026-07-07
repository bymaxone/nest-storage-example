// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/** @type {string[]} Imports banned in application code; use native Node or platform equivalents instead. */
const BANNED_IMPORTS = ['axios', 'bcrypt', 'jsonwebtoken', 'moment', 'lodash', 'uuid', 'dotenv']

export default tseslint.config(
  // Files and directories excluded from all linting
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/.stryker-tmp/**',
      '**/node_modules/**',
    ],
  },

  // Base JavaScript rules for all files
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
  },

  // TypeScript type-checked rules for all TS/TSX source files
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: BANNED_IMPORTS.map((name) => ({
            name,
            message: `Do not import '${name}'. Use Node built-ins or the platform-provided equivalent.`,
          })),
        },
      ],
    },
  },

  // Relaxed type-unsafe rules for test files (spec and e2e)
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
