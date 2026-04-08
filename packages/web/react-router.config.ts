import type { Config } from '@react-router/dev/config';

export default {
  ssr: true,
  routeDiscovery: { mode: 'lazy' },
} satisfies Config;
