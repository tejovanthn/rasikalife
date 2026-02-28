/**
 * Orchestrator Lambda — runs on a daily cron.
 *
 * 1. Queries all artists, organisers, and venues that have an Instagram socialLink.
 * 2. Invokes the InstagramScraper Lambda for each handle (fan-out).
 */

import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { Artist, Organiser, Venue } from '@rasika/core';

const lambdaClient = new LambdaClient({});

interface HandleRecord {
  handle: string;
  entityId: string;
  entityType: 'artist' | 'organiser' | 'venue';
}

function extractInstagramHandle(url: string): string | null {
  // Handle formats:
  //   https://www.instagram.com/handle/
  //   https://instagram.com/handle
  //   instagram.com/handle
  const match = url.match(/instagram\.com\/([A-Za-z0-9_.]+)\/?/);
  return match ? match[1] : null;
}

async function collectHandles(): Promise<HandleRecord[]> {
  const handles: HandleRecord[] = [];

  // --- Artists ---
  let artistCursor: string | undefined;
  do {
    const page = await Artist.listArtists({ limit: 100, nextToken: artistCursor });
    for (const artist of page.items) {
      for (const link of artist.socialLinks ?? []) {
        if (link.platform === 'instagram') {
          const handle = extractInstagramHandle(link.url);
          if (handle) {
            handles.push({ handle, entityId: artist.id, entityType: 'artist' });
            break;
          }
        }
      }
    }
    artistCursor = page.nextToken;
  } while (artistCursor);

  // --- Organisers ---
  let organiserCursor: string | undefined;
  do {
    const page = await Organiser.listOrganisers({ limit: 100, nextToken: organiserCursor });
    for (const organiser of page.items) {
      for (const link of organiser.socialLinks ?? []) {
        if (link.platform === 'instagram') {
          const handle = extractInstagramHandle(link.url);
          if (handle) {
            handles.push({ handle, entityId: organiser.id, entityType: 'organiser' });
            break;
          }
        }
      }
    }
    organiserCursor = page.nextToken;
  } while (organiserCursor);

  // --- Venues ---
  let venueCursor: string | undefined;
  do {
    const page = await Venue.listVenues({ limit: 100, nextToken: venueCursor });
    for (const venue of page.items) {
      for (const link of venue.socialLinks ?? []) {
        if (link.platform === 'instagram') {
          const handle = extractInstagramHandle(link.url);
          if (handle) {
            handles.push({ handle, entityId: venue.id, entityType: 'venue' });
            break;
          }
        }
      }
    }
    venueCursor = page.nextToken;
  } while (venueCursor);

  return handles;
}

async function invokeScraper(record: HandleRecord): Promise<void> {
  const functionName = process.env.INSTAGRAM_SCRAPER_FUNCTION_NAME;
  if (!functionName) throw new Error('INSTAGRAM_SCRAPER_FUNCTION_NAME not set');

  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event', // async invocation
      Payload: Buffer.from(
        JSON.stringify({
          Records: [{ body: JSON.stringify(record) }],
        })
      ),
    })
  );
}

export async function handler(): Promise<void> {
  console.log('[orchestrator] Collecting Instagram handles...');

  const handles = await collectHandles();
  console.log(`[orchestrator] Found ${handles.length} handles to scrape`);

  let succeeded = 0;
  let failed = 0;

  for (const record of handles) {
    try {
      await invokeScraper(record);
      succeeded++;
    } catch (err) {
      console.error(`[orchestrator] Failed to invoke scraper for @${record.handle}:`, err);
      failed++;
    }
  }

  console.log(`[orchestrator] Done. Invoked: ${succeeded}, Failed: ${failed}`);
}
