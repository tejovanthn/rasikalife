import { database } from './database';

const trpc = new sst.aws.Function('RasikaTRPC', {
  url: true,
  link: [database],
  handler: './packages/trpc/src/index.handler',
  environment: {
    DYNAMODB_TABLE: database.name,
    AWS_REGION: undefined,
  },
});

export { trpc };
