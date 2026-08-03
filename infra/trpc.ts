import { auth } from './auth';
import { classUploadsBucket } from './class-uploads';
import { database } from './database';
import { getDomain } from './domain';
import { email } from './email';
import { eventPostersBucket, eventPostersCdn, geminiApiKey } from './event-posters';
import { instagramImageFetcherFunction, instagramScraperFunction } from './instagram';
import { searchBucket, searchReindexFunction } from './search';

const trpc = new sst.aws.Function('RasikaTRPC', {
  url: true,
  link: [
    database,
    searchReindexFunction,
    searchBucket,
    auth,
    eventPostersBucket,
    instagramScraperFunction,
    instagramImageFetcherFunction,
    classUploadsBucket,
    email,
  ],
  handler: './packages/trpc/src/index.handler',
  timeout: '5 minutes',
  environment: {
    DYNAMODB_TABLE: database.name,
    AWS_REGION: undefined,
    SEARCH_INDEX_BUCKET: searchBucket.name,
    AUTH_URL: auth.url,
    EVENT_POSTERS_BUCKET: eventPostersBucket.name,
    GEMINI_API_KEY: geminiApiKey.value,
    EVENT_POSTERS_CDN_URL: eventPostersCdn.url,
    SEARCH_REINDEX_FUNCTION_NAME: searchReindexFunction.name,
    INSTAGRAM_SCRAPER_FUNCTION_NAME: instagramScraperFunction.name,
    INSTAGRAM_IMAGE_FETCHER_FUNCTION_NAME: instagramImageFetcherFunction.name,
    CLASS_UPLOADS_BUCKET: classUploadsBucket.name,
    EMAIL_SENDER: email.sender,
    // The invite email's sign-in link. Built here rather than in the app because only infra
    // knows the stage's real domain (classes.rasika.life in prod, classes.<stage>.rasika.life
    // otherwise).
    CLASSES_URL: `https://${getDomain('classes').name}`,
  },
});

export { trpc };
