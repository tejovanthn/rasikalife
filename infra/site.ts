import { trpc } from './trpc';

const bucket = new sst.aws.Bucket('RasikaBucket', {
  public: true,
});

const site = new sst.aws.Remix('RasikaWeb', {
  link: [bucket, trpc],
  path: 'packages/web/',
  domain: {
    name: $app.stage === 'prod' ? 'rasika.life' : `${$app.stage}.rasika.life`,
    redirects: $app.stage === 'prod' ? ['www.rasika.life'] : [`www.${$app.stage}.rasika.life`],
    dns: sst.aws.dns({
      zone: 'Z0190677U1NK4BAEXE0M',
    }),
  },
});

export { bucket, site };
