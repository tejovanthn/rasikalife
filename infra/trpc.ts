import { database } from './database';
import { searchBucket, searchReindexFunction } from './search';

const trpc = new sst.aws.Function('RasikaTRPC', {
  url: true,
  link: [database, searchReindexFunction, searchBucket],
  handler: './packages/trpc/src/index.handler',
  environment: {
    DYNAMODB_TABLE: database.name,
    AWS_REGION: undefined,
    SEARCH_INDEX_BUCKET: searchBucket.name,
  },
});

export { trpc };
