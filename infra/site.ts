import { auth } from './auth';
import { getCookieDomain, getDomain } from './domain';
import { blockBadBots } from './edge-security';
import { eventPostersBucket, eventPostersCdn } from './event-posters';
import { ogImageFunction } from './og-image';
import { bucket } from './storage';
import { trpc } from './trpc';

// SST's own server cache policy leaves every cookie out of the key, so one cached copy would be
// served to signed-in readers and to every script and theme choice alike. These three are the
// only cookies that change a rendered page (packages/web/app/lib/page-cache.ts). A signed-in
// response is `private` and never stored, so keying on the session only routes it past the
// cache. Otherwise the same as SST's: TTL 0 unless the response says otherwise.
const serverCachePolicy = new aws.cloudfront.CachePolicy('RasikaWebServerCachePolicy', {
  comment: 'rasika.life server responses, keyed on the cookies that change a page',
  defaultTtl: 0,
  maxTtl: 31536000,
  minTtl: 0,
  parametersInCacheKeyAndForwardedToOrigin: {
    cookiesConfig: {
      cookieBehavior: 'whitelist',
      cookies: { items: ['rasika_session', 'theme', 'script_preference'] },
    },
    headersConfig: {
      headerBehavior: 'whitelist',
      headers: { items: ['x-open-next-cache-key'] },
    },
    queryStringsConfig: { queryStringBehavior: 'all' },
    enableAcceptEncodingBrotli: true,
    enableAcceptEncodingGzip: true,
  },
});

const site = new sst.aws.React('RasikaWeb', {
  link: [bucket, trpc, auth, eventPostersBucket],
  path: 'packages/web/',
  domain: getDomain(''),
  cachePolicy: serverCachePolicy.id,
  edge: {
    viewerRequest: { injection: blockBadBots },
  },
  environment: {
    STAGE: $app.stage,
    VITE_STAGE: $app.stage,
    EVENT_POSTERS_BUCKET: eventPostersBucket.name,
    EVENT_POSTERS_CDN_URL: eventPostersCdn.url,
    OG_IMAGE_URL: ogImageFunction.url,
    // Scopes `rasika_session` to the stage root so classes.rasika.life shares the sign-in.
    SESSION_COOKIE_DOMAIN: getCookieDomain(),
  },
  server: {
    timeout: '60 seconds',
  },
});

export { bucket, site };
