import type { z } from 'zod';
import { SocialPostEntity } from './entity';
import type { SocialPost } from './entity';
import type { CreateSocialPostSchema, UpdateSocialPostStatusSchema } from './schema';

export type CreateSocialPostInput = z.infer<typeof CreateSocialPostSchema>;
export type UpdateSocialPostStatusInput = z.infer<typeof UpdateSocialPostStatusSchema>;

export async function createSocialPost(input: CreateSocialPostInput): Promise<SocialPost> {
  // Upsert to be idempotent — same post may be encountered on re-scrape
  const result = await SocialPostEntity.upsert({
    platform: input.platform,
    platformPostId: input.platformPostId,
    entityType: input.entityType,
    entityId: input.entityId,
    handle: input.handle,
    postUrl: input.postUrl,
    postText: input.postText ?? undefined,
    mediaUrls: input.mediaUrls,
    postedAt: input.postedAt,
    processingStatus: input.processingStatus,
  }).go();

  return result.data as SocialPost;
}

export async function getSocialPost(
  platform: string,
  platformPostId: string
): Promise<SocialPost | null> {
  const result = await SocialPostEntity.get({ platform, platformPostId }).go();
  return result.data ?? null;
}

export async function updateSocialPostStatus(
  platform: string,
  platformPostId: string,
  update: UpdateSocialPostStatusInput
): Promise<SocialPost> {
  const result = await SocialPostEntity.update({ platform, platformPostId })
    .set({
      processingStatus: update.processingStatus,
      ...(update.processedAt ? { processedAt: update.processedAt } : {}),
      ...(update.extractedEventId ? { extractedEventId: update.extractedEventId } : {}),
      ...(update.errorMessage ? { errorMessage: update.errorMessage } : {}),
    })
    .go({ response: 'all_new' });

  return result.data as SocialPost;
}

export async function markProcessed(
  platform: string,
  platformPostId: string,
  extractedEventId?: string
): Promise<void> {
  await SocialPostEntity.update({ platform, platformPostId })
    .set({
      processingStatus: 'processed',
      processedAt: new Date().toISOString(),
      ...(extractedEventId ? { extractedEventId } : {}),
    })
    .go();
}

export async function markSkipped(platform: string, platformPostId: string): Promise<void> {
  await SocialPostEntity.update({ platform, platformPostId })
    .set({
      processingStatus: 'skipped',
      processedAt: new Date().toISOString(),
    })
    .go();
}

export async function markFailed(
  platform: string,
  platformPostId: string,
  errorMessage: string
): Promise<void> {
  await SocialPostEntity.update({ platform, platformPostId })
    .set({
      processingStatus: 'failed',
      processedAt: new Date().toISOString(),
      errorMessage,
    })
    .go();
}

export async function listPendingPosts(params?: {
  limit?: number;
  nextToken?: string;
}): Promise<{ items: SocialPost[]; nextToken?: string; hasMore: boolean }> {
  const limit = params?.limit ?? 50;
  const result = await SocialPostEntity.query
    .byStatus({ processingStatus: 'pending' })
    .go({ limit, cursor: params?.nextToken });

  return {
    items: (result.data ?? []) as SocialPost[],
    nextToken: result.cursor ?? undefined,
    hasMore: !!result.cursor,
  };
}

export async function listPostsByEntity(
  entityType: string,
  entityId: string,
  params?: { limit?: number; nextToken?: string }
): Promise<{ items: SocialPost[]; nextToken?: string; hasMore: boolean }> {
  const limit = params?.limit ?? 50;
  const result = await SocialPostEntity.query
    .byEntity({ entityType, entityId })
    .go({ limit, cursor: params?.nextToken });

  return {
    items: (result.data ?? []) as SocialPost[],
    nextToken: result.cursor ?? undefined,
    hasMore: !!result.cursor,
  };
}

export async function getLatestPostIdForEntity(
  entityType: string,
  entityId: string
): Promise<string | null> {
  const result = await SocialPostEntity.query
    .byEntity({ entityType, entityId })
    .go({ limit: 1, order: 'desc' });

  const latest = result.data?.[0];
  return latest ? latest.platformPostId : null;
}

export type { SocialPost } from './entity';
export { CreateSocialPostSchema, UpdateSocialPostStatusSchema } from './schema';
