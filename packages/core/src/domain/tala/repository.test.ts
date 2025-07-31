import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tradition } from '../artist';
import { TalaRepository } from './repository';
import type { CreateTalaInput } from './schema';

// Simple, direct mocking
vi.mock('../../db', () => ({
  batchPutItems: vi.fn().mockResolvedValue(undefined),
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

describe('TalaRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a tala successfully', async () => {
      const input: CreateTalaInput = {
        name: 'Adi Tala',
        type: 'Suladi',
        aksharas: 8,
        tradition: Tradition.CARNATIC,
        editorId: 'user-123',
      };

      const result = await TalaRepository.create(input);

      expect(result).toMatchObject({
        name: 'Adi Tala',
        type: 'Suladi',
        aksharas: 8,
        tradition: Tradition.CARNATIC,
        version: 'v1',
      });
    });
  });

  describe('getById', () => {
    it('should return null when tala not found', async () => {
      const result = await TalaRepository.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should throw error when tala not found', async () => {
      const input = { structure: 'Updated structure', editorId: 'user-456' };

      await expect(TalaRepository.update('nonexistent', input)).rejects.toThrow(
        'Entity nonexistent not found'
      );
    });
  });

  describe('incrementViewCount', () => {
    it('should handle non-existent tala gracefully', async () => {
      // This should not throw since incrementViewCount returns early when entity not found
      await TalaRepository.incrementViewCount('nonexistent');
      // If we get here without throwing, the test passes
      expect(true).toBe(true);
    });
  });

  describe('search operations', () => {
    it('should return empty results when searching by name', async () => {
      const result = await TalaRepository.getByName('nonexistent');
      expect(result).toBeNull();
    });

    it('should return empty results when searching by aksharas', async () => {
      const result = await TalaRepository.getByAksharas(99);
      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });
});
