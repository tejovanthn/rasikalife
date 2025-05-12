// src/domain/raga/service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RagaService } from './service';
import { RagaRepository } from './repository';
import { type CreateRagaInput, UpdateRagaInput } from './schema';
import { Tradition } from '../artist';

// Mock the repository
vi.mock('./repository');

describe('RagaService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('createRaga', () => {
    it('should normalize raga name during creation', async () => {
      const input: CreateRagaInput = {
        name: 'bhairavi',
        tradition: Tradition.CARNATIC,
        editorId: 'user-123',
      };

      const mockRaga = {
        id: 'test-id',
        name: 'Bhairavi',
        tradition: Tradition.CARNATIC,
        version: 'v1',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        viewCount: 0,
        editedBy: ['user-123'],
        isLatest: true,
      };

      vi.mocked(RagaRepository.create).mockResolvedValue(mockRaga);

      const result = await RagaService.createRaga(input);

      // Check that name was normalized
      expect(RagaRepository.create).toHaveBeenCalledWith({
        ...input,
        name: 'Bhairavi',
      });

      expect(result).toEqual(mockRaga);
    });
  });

  describe('getRagaByName', () => {
    it('should try to find with original name then normalized name', async () => {
      // Mock first call returning null, second call returning a result
      vi.mocked(RagaRepository.getByName)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'test-id',
          name: 'Bhairavi',
          tradition: Tradition.CARNATIC,
          version: 'v1',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
          viewCount: 5,
          editedBy: ['user-123'],
          isLatest: true,
        });

      const raga = await RagaService.getRagaByName('bhairavi');

      // Should have tried with original name first
      expect(RagaRepository.getByName).toHaveBeenNthCalledWith(1, 'bhairavi');

      // Then with normalized name
      expect(RagaRepository.getByName).toHaveBeenNthCalledWith(2, 'Bhairavi');

      expect(raga).not.toBeNull();
      expect(raga?.name).toBe('Bhairavi');
    });
  });

  describe('searchRagas', () => {
    it('should call the appropriate repository method based on search params', async () => {
      // Mock repository methods
      vi.mocked(RagaRepository.search).mockResolvedValue({
        items: [{ id: 'test-id', name: 'Bhairavi' } as any],
        hasMore: false,
      });

      vi.mocked(RagaRepository.getByMelakarta).mockResolvedValue({
        items: [{ id: 'test-id-2', name: 'Shankarabharanam' } as any],
        hasMore: false,
      });

      vi.mocked(RagaRepository.getByTradition).mockResolvedValue({
        items: [{ id: 'test-id-3', name: 'Todi' } as any],
        hasMore: false,
      });

      // Test search by query
      let result = await RagaService.searchRagas({ query: 'bhair' });
      expect(RagaRepository.search).toHaveBeenCalledWith('bhair', undefined);
      expect(result.items[0].name).toBe('Bhairavi');

      // Test search by melakarta
      result = await RagaService.searchRagas({ melakarta: 29 });
      expect(RagaRepository.getByMelakarta).toHaveBeenCalledWith(29, undefined, undefined);
      expect(result.items[0].name).toBe('Shankarabharanam');

      // Test search by tradition
      result = await RagaService.searchRagas({ tradition: Tradition.CARNATIC });
      expect(RagaRepository.getByTradition).toHaveBeenCalledWith(
        Tradition.CARNATIC,
        undefined,
        undefined
      );
      expect(result.items[0].name).toBe('Todi');

      // Test empty search parameters
      result = await RagaService.searchRagas({});
      expect(result.items).toHaveLength(0);
    });
  });
});
