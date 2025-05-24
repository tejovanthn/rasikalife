import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/node_modules/**', '**/test/**', '**/*.test.ts', '**/types/**'],
    },
    setupFiles: ['./test/setup.ts'],
    testTimeout: 10000, // Increased timeout for integration tests
  },
}); 