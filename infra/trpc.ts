import { auth } from './auth';
import { database } from './database';
import { eventPostersBucket, geminiApiKey } from './event-posters';
import { searchBucket, searchReindexFunction } from './search';

const trpc = new sst.aws.Function('RasikaTRPC', {
  url: true,
  link: [database, searchReindexFunction, searchBucket, auth, eventPostersBucket],
  handler: './packages/trpc/src/index.handler',
  timeout: '5 minutes',
  environment: {
    DYNAMODB_TABLE: database.name,
    AWS_REGION: undefined,
    SEARCH_INDEX_BUCKET: searchBucket.name,
    AUTH_URL: auth.url,
    EVENT_POSTERS_BUCKET: eventPostersBucket.name,
    GEMINI_API_KEY: geminiApiKey.value,
    SEARCH_REINDEX_FUNCTION_NAME: searchReindexFunction.name,
  },
});

export { trpc };
