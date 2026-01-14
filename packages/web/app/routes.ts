import type { RouteConfig } from '@react-router/dev/routes';
import { remixRoutesOptionAdapter } from '@react-router/remix-routes-option-adapter';

export default remixRoutesOptionAdapter((defineRoutes: any) => {
  return defineRoutes((route: any) => {
    route('/sitemap.xml', 'routes/_null.tsx', {
      id: 'routes/sitemap.xml',
    });
    route('/robots.txt', 'routes/_null.tsx', {
      id: 'routes/robots.txt',
    });
  });
}) satisfies RouteConfig;
