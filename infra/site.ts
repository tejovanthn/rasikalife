import { auth } from './auth';
import { getDomain } from './domain';
import { eventPostersBucket, eventPostersCdn } from './event-posters';
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
  },
  server: {
    timeout: '60 seconds',
    nodejs: {
      install: ['sharp', '@img/sharp-linux-x64'],
    },
  },
});

export { bucket, site };
