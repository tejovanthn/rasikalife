import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./entity', () => ({
  SocialPostEntity: {
    upsert: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    query: { byStatus: vi.fn(), byEntity: vi.fn() },
  },
}));

import {
  CreateSocialPostSchema,
  createSocialPost,
  getLatestPostIdForEntity,
  getSocialPost,
  listPendingPosts,
  listPostsByEntity,
  listPostsByStatus,
  markFailed,
  markProcessed,
  markSkipped,
  updateSocialPostStatus,
} from '.';
import { SocialPostEntity } from './entity';

function goResolves(data: unknown) {
  return { go: vi.fn().mockResolvedValue({ data }) };
}

const baseInput = {
  platform: 'instagram' as const,
  platformPostId: 'post-1',
  entityType: 'artist' as const,
  entityId: 'artist-1',
  handle: '@artist',
  postUrl: 'https://instagram.com/p/post-1',
  mediaUrls: [],
  postedAt: '2026-01-01T00:00:00.000Z',
  processingStatus: 'pending' as const,
};

describe('social-post', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSocialPost', () => {
    it('upserts the post for idempotency on re-scrape', async () => {
      vi.mocked(SocialPostEntity.upsert).mockReturnValue(goResolves(baseInput) as never);

      const result = await createSocialPost(baseInput);

      expect(SocialPostEntity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ platform: 'instagram', platformPostId: 'post-1' })
      );
      expect(result).toEqual(baseInput);
    });
  });

  describe('getSocialPost', () => {
    it('returns the post when found', async () => {
      vi.mocked(SocialPostEntity.get).mockReturnValue(goResolves(baseInput) as never);

      expect(await getSocialPost('instagram', 'post-1')).toEqual(baseInput);
    });

    it('returns null when not found', async () => {
      vi.mocked(SocialPostEntity.get).mockReturnValue(goResolves(undefined) as never);

      expect(await getSocialPost('instagram', 'missing')).toBeNull();
    });
  });

  describe('updateSocialPostStatus', () => {
    it('only includes optional fields that are provided', async () => {
      const setSpy = vi.fn().mockReturnValue(goResolves({ processingStatus: 'processed' }));
      vi.mocked(SocialPostEntity.update).mockReturnValue({ set: setSpy } as never);

      await updateSocialPostStatus('instagram', 'post-1', { processingStatus: 'processed' });

      expect(setSpy).toHaveBeenCalledWith({ processingStatus: 'processed' });
    });

    it('includes processedAt/extractedEventId/errorMessage when given', async () => {
      const setSpy = vi.fn().mockReturnValue(goResolves({}));
      vi.mocked(SocialPostEntity.update).mockReturnValue({ set: setSpy } as never);

      await updateSocialPostStatus('instagram', 'post-1', {
        processingStatus: 'failed',
        processedAt: '2026-01-02T00:00:00.000Z',
        errorMessage: 'boom',
      });

      expect(setSpy).toHaveBeenCalledWith({
        processingStatus: 'failed',
        processedAt: '2026-01-02T00:00:00.000Z',
        errorMessage: 'boom',
      });
    });
  });

  describe('markProcessed', () => {
    it('sets status to processed with a timestamp', async () => {
      const setSpy = vi.fn().mockReturnValue(goResolves(undefined));
      vi.mocked(SocialPostEntity.update).mockReturnValue({ set: setSpy } as never);

      await markProcessed('instagram', 'post-1', 'event-1');

      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({ processingStatus: 'processed', extractedEventId: 'event-1' })
      );
    });
  });

  describe('markSkipped', () => {
    it('sets status to skipped', async () => {
      const setSpy = vi.fn().mockReturnValue(goResolves(undefined));
      vi.mocked(SocialPostEntity.update).mockReturnValue({ set: setSpy } as never);

      await markSkipped('instagram', 'post-1');

      expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ processingStatus: 'skipped' }));
    });
  });

  describe('markFailed', () => {
    it('sets status to failed with an error message', async () => {
      const setSpy = vi.fn().mockReturnValue(goResolves(undefined));
      vi.mocked(SocialPostEntity.update).mockReturnValue({ set: setSpy } as never);

      await markFailed('instagram', 'post-1', 'network error');

      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({ processingStatus: 'failed', errorMessage: 'network error' })
      );
    });
  });

  describe('listPostsByStatus', () => {
    it('queries byStatus with a default limit of 50, descending', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [baseInput] });
      vi.mocked(SocialPostEntity.query.byStatus).mockReturnValue({ go: goSpy } as never);

      const result = await listPostsByStatus('processed');

      expect(SocialPostEntity.query.byStatus).toHaveBeenCalledWith({
        processingStatus: 'processed',
      });
      expect(goSpy).toHaveBeenCalledWith(expect.objectContaining({ limit: 50, order: 'desc' }));
      expect(result.items).toHaveLength(1);
    });
  });

  describe('listPendingPosts', () => {
    it('queries byStatus for pending posts', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [] });
      vi.mocked(SocialPostEntity.query.byStatus).mockReturnValue({ go: goSpy } as never);

      await listPendingPosts();

      expect(SocialPostEntity.query.byStatus).toHaveBeenCalledWith({ processingStatus: 'pending' });
    });
  });

  describe('listPostsByEntity', () => {
    it('queries byEntity for the given entity', async () => {
      const goSpy = vi.fn().mockResolvedValue({ data: [baseInput] });
      vi.mocked(SocialPostEntity.query.byEntity).mockReturnValue({ go: goSpy } as never);

      const result = await listPostsByEntity('artist', 'artist-1');

      expect(SocialPostEntity.query.byEntity).toHaveBeenCalledWith({
        entityType: 'artist',
        entityId: 'artist-1',
      });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('getLatestPostIdForEntity', () => {
    it('returns the platformPostId of the most recent post', async () => {
      const goSpy = vi
        .fn()
        .mockResolvedValue({ data: [{ ...baseInput, platformPostId: 'latest' }] });
      vi.mocked(SocialPostEntity.query.byEntity).mockReturnValue({ go: goSpy } as never);

      const result = await getLatestPostIdForEntity('artist', 'artist-1');

      expect(goSpy).toHaveBeenCalledWith(expect.objectContaining({ limit: 1, order: 'desc' }));
      expect(result).toBe('latest');
    });

    it('returns null when there are no posts for the entity', async () => {
      vi.mocked(SocialPostEntity.query.byEntity).mockReturnValue(goResolves([]) as never);

      expect(await getLatestPostIdForEntity('artist', 'artist-1')).toBeNull();
    });
  });

  describe('CreateSocialPostSchema', () => {
    it('accepts valid input and defaults processingStatus/mediaUrls', () => {
      const parsed = CreateSocialPostSchema.parse({
        platform: 'instagram',
        platformPostId: 'post-1',
        entityType: 'artist',
        entityId: 'artist-1',
        handle: '@artist',
        postUrl: 'https://instagram.com/p/post-1',
        postedAt: '2026-01-01T00:00:00.000Z',
      });

      expect(parsed.processingStatus).toBe('pending');
      expect(parsed.mediaUrls).toEqual([]);
    });

    it('rejects an invalid postUrl', () => {
      expect(() => CreateSocialPostSchema.parse({ ...baseInput, postUrl: 'not-a-url' })).toThrow();
    });

    it('rejects an unknown entityType', () => {
      expect(() => CreateSocialPostSchema.parse({ ...baseInput, entityType: 'raga' })).toThrow();
    });
  });
});
