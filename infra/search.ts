// infra/search.ts

import { database } from "./database";

const searchBucket = new sst.aws.Bucket('SearchIndexBucket', {
  public: false,
});

const searchReindexFunction = new sst.aws.Function('SearchReindex', {
  handler: './packages/search/src/refresh-index.handler',
  timeout: '300 seconds',
  memory: '1024 MB',
  link: [searchBucket, database],
  url: true,
  environment: {
    DYNAMODB_TABLE: database.name,
    AWS_REGION: undefined,
    SEARCH_INDEX_BUCKET: searchBucket.name,
  },
});

new sst.aws.Cron('SearchIndexCron', {
  schedule: 'rate(6 hours)',
  function: searchReindexFunction.arn,
});

export { searchBucket, searchReindexFunction };
