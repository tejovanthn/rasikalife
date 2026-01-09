import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tradition } from '../artist';
import { CompositionRepository } from './repository';
import type { CreateAttributionInput, CreateCompositionInput } from './schema';
import { AttributionConfidence, AttributionType } from './types';

// Simple, direct mocking
vi.mock('../../db', () => ({
  batchPutItems: vi.fn().mockResolvedValue(undefined),
  getItem: vi.fn().mockResolvedValue(null),
  getByPrimaryKey: vi.fn().mockResolvedValue(null),
  putItem: vi.fn().mockResolvedValue(undefined),
  updateItem: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
}));

vi.mock('../../shared/accessPatterns', () => ({
  getAllByPartitionKey: vi.fn().mockResolvedValue({ items: [], lastEvaluatedKey: undefined }),
  getByGlobalIndex: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
  getByPrimaryKey: vi.fn().mockResolvedValue(null),
}));

describe('CompositionRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a composition successfully', async () => {
      const input: CreateCompositionInput = {
        title: 'Vathapi Ganapathim',
        language: 'Sanskrit',
        tradition: Tradition.CARNATIC,
        editorId: 'user-123',
      };

      const result = await CompositionRepository.create(input);

      expect(result).toMatchObject({
        title: 'Vathapi Ganapathim',
        language: 'Sanskrit',
        tradition: Tradition.CARNATIC,
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.editedBy).toEqual(['user-123']);
    });
  });

  describe('getById', () => {
    it('should return null when composition not found', async () => {
      const result = await CompositionRepository.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should throw error when composition not found', async () => {
      const input = { title: 'Updated Title', editorId: 'user-456' };

      await expect(CompositionRepository.update('nonexistent', input)).rejects.toThrow(
        'Composition nonexistent not found'
      );
    });
  });

  describe('incrementViewCount', () => {
    it('should handle non-existent composition gracefully', async () => {
      // This should not throw since incrementViewCount returns early when entity not found
      await CompositionRepository.incrementViewCount('nonexistent');
      // If we get here without throwing, the test passes
      expect(true).toBe(true);
    });
  });

  describe('createAttribution', () => {
    it('should create attribution successfully', async () => {
      const input: CreateAttributionInput = {
        compositionId: 'comp-123',
        artistId: 'artist-456',
        attributionType: AttributionType.PRIMARY,
        confidence: AttributionConfidence.HIGH,
        addedBy: 'user-123',
      };

      const result = await CompositionRepository.createAttribution(input);

      expect(result).toMatchObject({
        compositionId: 'comp-123',
        artistId: 'artist-456',
        attributionType: AttributionType.PRIMARY,
      });
    });
  });

  describe('verifyAttribution', () => {
    it('should throw error when attribution not found', async () => {
      await expect(
        CompositionRepository.verifyAttribution('comp-123', 'artist-456', 'user-789')
      ).rejects.toThrow('Attribution for composition comp-123 and artist artist-456 not found');
    });
  });

  describe('search operations', () => {
    it('should return empty results when searching by title', async () => {
      const result = await CompositionRepository.searchByTitle('nonexistent');
      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('should return empty results when getting compositions by artist', async () => {
      const result = await CompositionRepository.getCompositionsByArtistId('nonexistent');
      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });
});
