import { database } from './database';
import { geminiApiKey } from './event-posters';

// Dead-letter queue for failed extraction messages
const instagramDlq = new sst.aws.Queue('InstagramDLQ');

// Queue of SocialPost IDs ready for Gemini extraction
// visibilityTimeout must be >= subscriber Lambda timeout (120s); use 6x per AWS recommendation
export const instagramPostQueue = new sst.aws.Queue('InstagramPostQueue', {
  dlq: instagramDlq.arn,
  visibilityTimeout: '12 minutes',
});

// Lambda that calls the Instagram web API to scrape recent posts.
// Uses plain fetch — no headless browser needed.
export const instagramScraperFunction = new sst.aws.Function('InstagramScraper', {
  handler: 'packages/scraper/src/handler.handler',
  link: [database, instagramPostQueue],
  memory: '256 MB',
  timeout: '5 minutes',
  environment: {
    DYNAMODB_TABLE: database.name,
    INSTAGRAM_POST_QUEUE_URL: instagramPostQueue.url,
  },
});

// Lambda that pulls from InstagramPostQueue and runs Gemini extraction
instagramPostQueue.subscribe({
  handler: 'packages/scraper/src/extractor.handler',
  link: [database, geminiApiKey],
  memory: '512 MB',
  timeout: '2 minutes',
  environment: {
    DYNAMODB_TABLE: database.name,
    GEMINI_API_KEY: geminiApiKey.value,
  },
});

// Orchestrator Lambda — queries all entities with Instagram links and
// fans out scrape jobs to the scraper function
export const instagramSyncFunction = new sst.aws.Function('InstagramSyncOrchestrator', {
  handler: 'packages/scraper/src/orchestrator.handler',
  link: [database, instagramScraperFunction],
  memory: '256 MB',
  timeout: '5 minutes',
  environment: {
    DYNAMODB_TABLE: database.name,
    INSTAGRAM_SCRAPER_FUNCTION_NAME: instagramScraperFunction.name,
  },
});

// Lambda that uses Puppeteer + stealth to fetch the image URL from a public Instagram post.
// Invoked synchronously by the tRPC Lambda; kept separate so Chromium doesn't bloat the API bundle.
export const instagramImageFetcherFunction = new sst.aws.Function('InstagramImageFetcher', {
  handler: 'packages/scraper/src/instagram-image-fetcher.handler',
  nodejs: {
    install: [
      '@sparticuz/chromium',
      'puppeteer-core',
      'puppeteer-extra',
      'puppeteer-extra-plugin-stealth',
    ],
  },
  memory: '2 GB',
  timeout: '3 minutes',
  environment: {},
});

// Daily cron
new sst.aws.Cron('InstagramSyncCron', {
  schedule: 'rate(24 hours)',
  job: {
    handler: 'packages/scraper/src/orchestrator.handler',
    link: [database, instagramScraperFunction],
    memory: '256 MB',
    timeout: '5 minutes',
    environment: {
      DYNAMODB_TABLE: database.name,
      INSTAGRAM_SCRAPER_FUNCTION_NAME: instagramScraperFunction.name,
    },
  },
});
