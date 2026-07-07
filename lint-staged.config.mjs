/** @type {import('lint-staged').Config} */
const config = {
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{md,json,yml,yaml,mjs}': ['prettier --write'],
}

export default config
