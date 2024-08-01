import { database } from './database';

const trpc = new sst.aws.Function('RasikaTRPC', {
  url: true,
  link: [database],
  handler: './packages/functions/src/index.handler',
});

const client = new sst.aws.Function('RasikaClient', {
  url: true,
  link: [trpc],
  handler: './packages/functions/src/client.handler',
});

export { trpc, client };
