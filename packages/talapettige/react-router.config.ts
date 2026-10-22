import type { Config } from '@react-router/dev/config';

/**
 * A static app. Every sound is synthesised in the browser and every setting lives in
 * `localStorage`, so there is nothing for a server to do. Each route is prerendered to its own
 * HTML file, which is what lets the service worker precache them and the app open offline.
 */
export default {
  ssr: false,
  prerender: ['/', '/about', '/history'],
} satisfies Config;
