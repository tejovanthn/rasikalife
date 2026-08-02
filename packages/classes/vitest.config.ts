import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['app/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '~': resolve(__dirname, './app') },
  },
});
