import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['api/src/**/tests/**/*.spec.ts', 'app/src/**/tests/**/*.spec.ts'],
    // Each database suite starts its own PostgreSQL WASM instance.
    maxWorkers: 2,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  oxc: { transform: { legacyDecorator: true } },
});
