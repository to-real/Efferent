import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    // e2e 由 Playwright 负责（playwright.config.ts），vitest 不认领
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
})
