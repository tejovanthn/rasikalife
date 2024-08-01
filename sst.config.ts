// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'rasika',
      removal: input?.stage === 'prod' ? 'retain' : 'remove',
      home: 'aws',
    };
  },
  async run() {
    const infra = await import('./infra');

    return {
      site: infra.site.url,
      trpc: infra.trpc.url,
      client: infra.client.url,
    };
  },
});
