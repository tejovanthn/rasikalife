import { getDomain } from './domain';

/**
 * Talapettige — a tanpura and tala practice app at `talapettige.rasika.life`.
 *
 * A static site, not `sst.aws.React`: the sound is synthesised in the browser and every setting
 * lives in `localStorage`, so there is no server, no session and no link to anything else here.
 * Each route is prerendered at build time (`packages/talapettige/react-router.config.ts`).
 *
 * The service worker precaches the whole build so the installed app opens offline. That makes
 * cache headers matter: `sw.js` and the pages must always be revalidated, or a browser keeps
 * the old worker and never learns a new deploy exists. Only `assets/` carries a content hash,
 * so only `assets/` is immutable. A later entry wins over an earlier one.
 */
const talapettigeSite = new sst.aws.StaticSite('Talapettige', {
  path: 'packages/talapettige/',
  build: {
    command: 'pnpm run build',
    output: 'build/client',
  },
  domain: getDomain('talapettige'),
  assets: {
    fileOptions: [
      { files: '**', cacheControl: 'public,max-age=0,must-revalidate' },
      { files: 'assets/**', cacheControl: 'public,max-age=31536000,immutable' },
    ],
  },
  dev: {
    command: 'pnpm run dev',
  },
});

export { talapettigeSite };
