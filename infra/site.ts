import { auth } from './auth';
import { getDomain } from './domain';
import { bucket } from './storage';
import { trpc } from './trpc';

const site = new sst.aws.React('RasikaWeb', {
  link: [bucket, trpc, auth],
  path: 'packages/web/',
  domain: getDomain(''),
  environment: {
    STAGE: $app.stage,
  },
});

export { bucket, site };
