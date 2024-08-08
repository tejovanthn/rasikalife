import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import { envOnlyMacros } from 'vite-env-only';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    envOnlyMacros(),
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
      routes(defineRoutes) {
        return defineRoutes((route) => {
          route('/sitemap.xml', 'routes/_null.tsx', {
            id: 'routes/sitemap.xml',
          }),
            route('/robots.txt', 'routes/_null.tsx', {
              id: 'routes/robots.txt',
            });
        });
      },
    }),
    tsconfigPaths(),
  ],
});
