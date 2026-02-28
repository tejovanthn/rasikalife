import { Artist, Organiser, SocialPost, Venue } from '@rasika/core';
import { scrapeInstagramProfile } from '../../scraper/src/instagram.js';

interface SyncOptions {
  handle?: string;
  dryRun?: boolean;
  reprocess?: boolean;
}

interface HandleRecord {
  handle: string;
  entityId: string;
  entityType: 'artist' | 'organiser' | 'venue';
}

function extractInstagramHandle(url: string): string | null {
  const match = url.match(/instagram\.com\/([A-Za-z0-9_.]+)\/?/);
  return match ? match[1] : null;
}

async function collectHandles(filterHandle?: string): Promise<HandleRecord[]> {
  const handles: HandleRecord[] = [];

  // Artists
  let artistCursor: string | undefined;
  do {
    const page = await Artist.listArtists({ limit: 100, nextToken: artistCursor });
    for (const artist of page.items) {
      for (const link of artist.socialLinks ?? []) {
        if (link.platform === 'instagram') {
          const handle = extractInstagramHandle(link.url);
          if (handle && (!filterHandle || handle === filterHandle)) {
            handles.push({ handle, entityId: artist.id, entityType: 'artist' });
            break;
          }
        }
      }
    }
    artistCursor = page.nextToken;
  } while (artistCursor);

  // Organisers
  let organiserCursor: string | undefined;
  do {
    const page = await Organiser.listOrganisers({ limit: 100, nextToken: organiserCursor });
    for (const organiser of page.items) {
      for (const link of organiser.socialLinks ?? []) {
        if (link.platform === 'instagram') {
          const handle = extractInstagramHandle(link.url);
          if (handle && (!filterHandle || handle === filterHandle)) {
            handles.push({ handle, entityId: organiser.id, entityType: 'organiser' });
            break;
          }
        }
      }
    }
    organiserCursor = page.nextToken;
  } while (organiserCursor);

  // Venues
  let venueCursor: string | undefined;
  do {
    const page = await Venue.listVenues({ limit: 100, nextToken: venueCursor });
    for (const venue of page.items) {
      for (const link of venue.socialLinks ?? []) {
        if (link.platform === 'instagram') {
          const handle = extractInstagramHandle(link.url);
          if (handle && (!filterHandle || handle === filterHandle)) {
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

export async function syncInstagram(options: SyncOptions = {}): Promise<void> {
  const { handle: filterHandle, dryRun = false, reprocess = false } = options;

  console.log(
    `[sync:instagram] Starting${dryRun ? ' (dry-run)' : ''}${filterHandle ? ` for @${filterHandle}` : ' all handles'}`
  );

  let handles: HandleRecord[];

  if (filterHandle) {
    // Collect matching handle from DB, or use it directly if not found
    const dbHandles = await collectHandles(filterHandle);
    if (dbHandles.length > 0) {
      handles = dbHandles;
    } else {
      console.log(
        `[sync:instagram] Handle @${filterHandle} not found in DB — scraping as standalone`
      );
      handles = [{ handle: filterHandle, entityId: filterHandle, entityType: 'artist' }];
    }
  } else {
    handles = await collectHandles();
  }

  console.log(`[sync:instagram] Found ${handles.length} handle(s) to process`);

  if (handles.length === 0) {
    console.log(
      '[sync:instagram] No Instagram handles found. Add socialLinks to artists/venues/organisers.'
    );
    return;
  }

  let totalPosts = 0;
  let newPosts = 0;

  for (const record of handles) {
    console.log(
      `\n[sync:instagram] Scraping @${record.handle} (${record.entityType}/${record.entityId})`
    );

    const lastPostId = reprocess
      ? undefined
      : await SocialPost.getLatestPostIdForEntity(record.entityType, record.entityId);

    let posts;
    try {
      posts = await scrapeInstagramProfile(record.handle, {
        sincePostId: lastPostId ?? undefined,
        maxPosts: 30,
      });
    } catch (err) {
      console.error(`[sync:instagram] Failed to scrape @${record.handle}:`, err);
      continue;
    }

    console.log(`  Found ${posts.length} post(s) (since ${lastPostId ?? 'beginning'})`);
    totalPosts += posts.length;

    for (const post of posts) {
      console.log(`  - ${post.shortcode}: ${post.caption.substring(0, 80).replace(/\n/g, ' ')}...`);

      if (dryRun) continue;

      // Upsert the SocialPost record
      await SocialPost.createSocialPost({
        platform: 'instagram',
        platformPostId: post.shortcode,
        entityType: record.entityType,
        entityId: record.entityId,
        handle: record.handle,
        postUrl: post.postUrl,
        postText: post.caption,
        mediaUrls: post.mediaUrls,
        postedAt: post.timestamp,
        processingStatus: 'pending',
      });
      newPosts++;
    }
  }

  if (dryRun) {
    console.log(`\n[sync:instagram] Dry-run complete. Would have written ${totalPosts} post(s).`);
  } else {
    console.log(
      `\n[sync:instagram] Done. Scraped ${totalPosts} post(s), wrote ${newPosts} new records.`
    );
    if (newPosts > 0) {
      console.log(
        '[sync:instagram] Posts are queued as "pending". Run extraction to process them.'
      );
    }
  }
}
