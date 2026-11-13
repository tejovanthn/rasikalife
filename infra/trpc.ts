import { auth } from './auth';
import { classUploadsBucket } from './class-uploads';
import { database } from './database';
import { getDomain } from './domain';
import { email } from './email';
import { eventPostersBucket, eventPostersCdn, geminiApiKey } from './event-posters';
import { instagramImageFetcherFunction, instagramScraperFunction } from './instagram';
import { unsubscribeSecret } from './notify';
import { privateFilesBucket, qrRenderQueue } from './qr';
import { searchBucket, searchReindexFunction } from './search';
import { siteCacheEnvironment, siteCachePermissions } from './site-cache';

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
    unsubscribeSecret,
    privateFilesBucket,
    qrRenderQueue,
  ],
  handler: './packages/trpc/src/index.handler',
  timeout: '5 minutes',
  // Mutations clear the page cache (packages/trpc/src/middleware/site-cache.ts).
  permissions: siteCachePermissions,
  environment: {
    ...siteCacheEnvironment,
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
    // QR batch PDFs: the queue the renderer listens on, and the bucket it writes to.
    QR_RENDER_QUEUE_URL: qrRenderQueue.url,
    PRIVATE_FILES_BUCKET: privateFilesBucket.name,
    EMAIL_SENDER: email.sender,
    // Verifies `/unsubscribe/:token` links (`notify.checkUnsubscribe`, `notify.unsubscribe`).
    UNSUBSCRIBE_SECRET: unsubscribeSecret.value,
    // The invite email's sign-in link. Built here rather than in the app because only infra
    // knows the stage's real domain (classes.rasika.life in prod, classes.<stage>.rasika.life
    // otherwise).
    CLASSES_URL: `https://${getDomain('classes').name}`,
    // The approval email's links, for the same reason: rasika.life in prod, <stage>.rasika.life
    // otherwise.
    SITE_URL: `https://${getDomain().name}`,
    // The partner invite email's link: sabha.rasika.life in prod, sabha.<stage>.rasika.life
    // otherwise.
    SABHA_URL: `https://${getDomain('sabha').name}`,
    // Where `/for-sabhas` requests are emailed (packages/trpc/src/sabha-request-email.ts).
    SABHA_REQUEST_TO: 'hello@rasika.life',
  },
});

export { trpc };
