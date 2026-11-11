import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
  },
  test: {
    environment: 'node',
    // The analysis tests run whole synthetic songs; on a loaded CI runner they
    // can exceed the 5 s default even though they take under 1 s alone.
    testTimeout: 60_000,
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts', 'cloudflare/**/*.test.ts'],
  },
});
