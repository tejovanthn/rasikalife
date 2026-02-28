/**
 * Lambda handler for the Instagram scraper.
 *
 * Triggered by:
 *   1. InstagramSyncCron (daily) — orchestrator passes all handles via SQS
 *   2. Direct invocation with { handle, entityId, entityType }
 *
 * Message format (from SQS or direct):
 *   {
 *     handle: string,
 *     entityId: string,
 *     entityType: 'artist' | 'organiser' | 'venue',
 *   }
 */

import { SocialPost } from '@rasika/core';
import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { scrapeInstagramProfile } from './instagram.js';

interface ScrapeMessage {
  handle: string;
  entityId: string;
  entityType: 'artist' | 'organiser' | 'venue';
}

async function processHandle(msg: ScrapeMessage): Promise<void> {
  const { handle, entityId, entityType } = msg;

  console.log(`[scraper] Starting scrape for @${handle} (${entityType}/${entityId})`);

  // Find the most recent post we already have to avoid re-processing
  const lastPostId = await SocialPost.getLatestPostIdForEntity(entityType, entityId);

  const posts = await scrapeInstagramProfile(handle, {
    sincePostId: lastPostId ?? undefined,
    maxPosts: 30,
  });

  console.log(`[scraper] Found ${posts.length} new posts for @${handle}`);

  if (posts.length === 0) return;

  // Write SocialPost records (upsert — safe to run multiple times)
  for (const post of posts) {
    await SocialPost.createSocialPost({
      platform: 'instagram',
      platformPostId: post.shortcode,
      entityType,
      entityId,
      handle,
      postUrl: post.postUrl,
      postText: post.caption,
      mediaUrls: post.mediaUrls,
      postedAt: post.timestamp,
      processingStatus: 'pending',
    });
  }

  console.log(`[scraper] Wrote ${posts.length} SocialPost records for @${handle}`);
}

export async function handler(event: SQSEvent): Promise<void> {
  const records: SQSRecord[] = event.Records ?? [];

  for (const record of records) {
    let msg: ScrapeMessage;
    try {
      msg = JSON.parse(record.body) as ScrapeMessage;
    } catch (err) {
      console.error('[scraper] Failed to parse SQS message:', record.body, err);
      continue;
    }

    try {
      await processHandle(msg);
    } catch (err) {
      console.error(`[scraper] Error processing @${msg.handle}:`, err);
      // Re-throw so SQS can retry / send to DLQ
      throw err;
    }
  }
}
