import { auth } from './auth';
import { getCookieDomain, getDomain } from './domain';
import { eventPostersBucket, eventPostersCdn } from './event-posters';
import { ogImageFunction } from './og-image';
import { bucket } from './storage';
import { trpc } from './trpc';

const site = new sst.aws.React('RasikaWeb', {
  link: [bucket, trpc, auth, eventPostersBucket],
  path: 'packages/web/',
  domain: getDomain(''),
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
