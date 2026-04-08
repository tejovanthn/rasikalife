import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import { envOnlyMacros } from 'vite-env-only';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [envOnlyMacros(), reactRouter(), tsconfigPaths()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-table': ['@tanstack/react-table'],
          'vendor-markdown': ['react-markdown'],
        },
      },
    },
  },
});
