import { defineConfig } from 'vitest/config';

/**
 * Unit tests, with no setup file.
 *
 * `vitest.config.ts` is for integration tests: its `test/setup.ts` talks to real DynamoDB
 * through SST, which is why those runs need `sst shell`. That setup imports `@rasika/core` at
 * load time, *before* any test file's `vi.mock` is applied, so a unit test that mocks the module
 * wholesale fails in `beforeEach` and never reaches an assertion.
 *
 * Two configs rather than one conditional setup file, because "does this test need AWS" is a
 * property of the test, and a `*.unit.test.ts` suffix says so at a glance.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.unit.test.ts'],
  },
});
