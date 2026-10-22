import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  // `@rasika/ui` ships TypeScript source rather than a build step, so Vite has to compile it
  // rather than treat it as an external dependency.
  ssr: { noExternal: ['@rasika/ui'] },
});
