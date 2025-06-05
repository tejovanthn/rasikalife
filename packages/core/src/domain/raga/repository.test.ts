import { vi, describe, beforeEach, it, expect } from 'vitest';
import { RagaRepository } from './repository';
import type { CreateRagaInput } from './schema';
import { Tradition } from '../artist';

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

describe('RagaRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a raga successfully', async () => {
      const input: CreateRagaInput = {
        name: 'Bhairavi',
        tradition: Tradition.CARNATIC,
        editorId: 'user-123',
      };

      const result = await RagaRepository.create(input);

      expect(result).toMatchObject({
        name: 'Bhairavi',
        tradition: Tradition.CARNATIC,
        version: 'v1',
      });
    });
  });

  describe('getById', () => {
    it('should return null when raga not found', async () => {
      const result = await RagaRepository.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should throw error when raga not found', async () => {
      const input = { notes: 'Updated notes', editorId: 'user-456' };

      await expect(
        RagaRepository.update('nonexistent', input)
      ).rejects.toThrow('Entity nonexistent not found');
    });
  });

  describe('incrementViewCount', () => {
    it('should handle non-existent raga gracefully', async () => {
      // This should not throw since incrementViewCount returns early when entity not found
      await RagaRepository.incrementViewCount('nonexistent');
      // If we get here without throwing, the test passes
      expect(true).toBe(true);
    });
  });

  describe('search operations', () => {
    it('should return empty results when searching by name', async () => {
      const result = await RagaRepository.getByName('nonexistent');
      expect(result).toBeNull();
    });
  });
});