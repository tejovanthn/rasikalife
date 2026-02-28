/**
 * Lambda handler for the SocialPostExtractor.
 *
 * Triggered by InstagramPostQueue (SQS).
 *
 * Message format: { socialPostId: string }
 *   where socialPostId = `${platform}#${platformPostId}`
 */

import { Event, SocialPost } from '@rasika/core';
import type { SQSEvent, SQSRecord } from 'aws-lambda';

interface ExtractionMessage {
  platform: string;
  platformPostId: string;
}

async function processPost(platform: string, platformPostId: string): Promise<void> {
  const post = await SocialPost.getSocialPost(platform, platformPostId);
  if (!post) {
    console.warn(`[extractor] SocialPost not found: ${platform}#${platformPostId}`);
    return;
  }

  if (post.processingStatus !== 'pending') {
    console.log(`[extractor] Skipping already-processed post ${platformPostId}`);
    return;
  }

  console.log(`[extractor] Extracting from post ${platformPostId} (${post.handle})`);

  let extraction: Event.ExtractionResult;
  try {
    extraction = await Event.extractFromSocialPost({
      postText: post.postText,
      mediaUrl: post.mediaUrls?.[0],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[extractor] Gemini extraction failed for ${platformPostId}:`, err);
    await SocialPost.markFailed(platform, platformPostId, message);
    return;
  }

  if (extraction.events.length === 0 || extraction.confidence < 0.3) {
    console.log(
      `[extractor] No event found in post ${platformPostId} (confidence ${extraction.confidence})`
    );
    await SocialPost.markSkipped(platform, platformPostId);
    return;
  }

  // Use the system user for AI-extracted events
  const systemUserId = 'system-instagram-extractor';
  const eventData = extraction.events[0];

  let eventId: string | undefined;
  try {
    const created = await Event.createEvent(
      {
        title: eventData.title,
        description: eventData.description ?? undefined,
        startDateTime: eventData.startDateTime,
        endDateTime: eventData.endDateTime ?? undefined,
        venueName: eventData.venue?.name,
        organiserName: eventData.organiser?.name,
        artists: eventData.artists.map(a => ({
          name: a.name,
          title: a.title ?? undefined,
          role: a.role ?? undefined,
        })),
        tags: eventData.tags,
        entryType: eventData.entryType ?? 'free',
        ticketing: eventData.ticketing ?? undefined,
        contactInfo: eventData.contactInfo ?? undefined,
        sponsors: eventData.sponsors ?? undefined,
        sourcePlatform: 'instagram',
        sourcePostId: platformPostId,
        sourcePostUrl: post.postUrl,
        extractionConfidence: extraction.confidence,
        extractionRawResponse: JSON.stringify(extraction),
        extractionTimestamp: new Date().toISOString(),
      },
      systemUserId,
      { status: 'draft' }
    );
    eventId = created.id;
    console.log(`[extractor] Created draft event ${eventId} from post ${platformPostId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[extractor] Failed to create event for post ${platformPostId}:`, err);
    await SocialPost.markFailed(platform, platformPostId, message);
    return;
  }

  await SocialPost.markProcessed(platform, platformPostId, eventId);
}

export async function handler(event: SQSEvent): Promise<void> {
  const records: SQSRecord[] = event.Records ?? [];

  for (const record of records) {
    let msg: ExtractionMessage;
    try {
      msg = JSON.parse(record.body) as ExtractionMessage;
    } catch (err) {
      console.error('[extractor] Failed to parse SQS message:', record.body, err);
      continue;
    }

    try {
      await processPost(msg.platform, msg.platformPostId);
    } catch (err) {
      console.error(`[extractor] Error processing ${msg.platformPostId}:`, err);
      throw err;
    }
  }
}
