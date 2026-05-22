import { eventPostersBucket, eventPostersCdn } from './event-posters';
import { trpc } from './trpc';

// Dedicated Lambda for OG share image generation. Sharp lives here — not in the
// React server bundle — so the web Lambda stays slim and we don't fight SST's
// React SSR bundler over native modules.
export const ogImageFunction = new sst.aws.Function('OgImage', {
  url: true,
  handler: 'packages/og-image/src/handler.handler',
  link: [eventPostersBucket],
  memory: '1024 MB',
  timeout: '30 seconds',
  nodejs: {
    install: ['sharp', '@img/sharp-linux-x64', '@img/sharp-libvips-linux-x64'],
  },
  environment: {
    EVENT_POSTERS_BUCKET: eventPostersBucket.name,
    EVENT_POSTERS_CDN_URL: eventPostersCdn.url,
    TRPC_URL: trpc.url,
  },
});
