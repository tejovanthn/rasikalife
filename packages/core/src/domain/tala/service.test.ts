// src/domain/tala/service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TalaService } from './service';
import { TalaRepository } from './repository';
import type { CreateTalaInput, UpdateTalaInput } from './schema';
import { Tradition } from '../artist';

// Mock the repository
vi.mock('./repository');

describe('TalaService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('createTala', () => {
    it('should normalize tala name during creation', async () => {
      const input: CreateTalaInput = {
        name: 'adi tala',
        aksharas: 8,
        type: 'suladi',
        tradition: Tradition.CARNATIC,
        editorId: 'user-123',
      };

      const mockTala = {
        id: 'test-id',
        name: 'Adi Tala',
        type: 'Suladi',
        aksharas: 8,
        tradition: Tradition.CARNATIC,
        version: 'v1',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        viewCount: 0,
        editedBy: ['user-123'],
        isLatest: true,
      };

      vi.mocked(TalaRepository.create).mockResolvedValue(mockTala);

      const result = await TalaService.createTala(input);

      // Check that name and type were normalized
      expect(TalaRepository.create).toHaveBeenCalledWith({
        ...input,
        name: 'Adi Tala',
      });

      expect(result).toEqual(mockTala);
    });
  });

  describe('getTalaByName', () => {
    it('should try to find with original name then normalized name', async () => {
      // Mock first call returning null, second call returning a result
      vi.mocked(TalaRepository.getByName)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'test-id',
          name: 'Adi Tala',
          type: 'Suladi',
          aksharas: 8,
          tradition: Tradition.CARNATIC,
          version: 'v1',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
          viewCount: 5,
          editedBy: ['user-123'],
          isLatest: true,
        });

      const tala = await TalaService.getTalaByName('adi tala');

      // Should have tried with original name first
      expect(TalaRepository.getByName).toHaveBeenNthCalledWith(1, 'adi tala');

      // Then with normalized name
      expect(TalaRepository.getByName).toHaveBeenNthCalledWith(2, 'Adi Tala');

      expect(tala).not.toBeNull();
      expect(tala?.name).toBe('Adi Tala');
    });
  });

  describe('searchTalas', () => {
    it('should call the appropriate repository method based on search params', async () => {
      // Mock repository methods
      vi.mocked(TalaRepository.search).mockResolvedValue({
        items: [{ id: 'test-id', name: 'Adi Tala' } as any],
        hasMore: false,
      });

      vi.mocked(TalaRepository.getByAksharas).mockResolvedValue({
        items: [{ id: 'test-id-2', name: 'Rupaka Tala' } as any],
        hasMore: false,
      });

      vi.mocked(TalaRepository.getByType).mockResolvedValue({
        items: [{ id: 'test-id-3', name: 'Misra Chapu' } as any],
        hasMore: false,
      });

      vi.mocked(TalaRepository.getByTradition).mockResolvedValue({
        items: [{ id: 'test-id-4', name: 'Khanda Jati Triputa' } as any],
        hasMore: false,
      });

      // Test search by query
      let result = await TalaService.searchTalas({ query: 'adi' });
      expect(TalaRepository.search).toHaveBeenCalledWith('adi', undefined);
      expect(result.items[0].name).toBe('Adi Tala');

      // Test search by aksharas
      result = await TalaService.searchTalas({ aksharas: 6 });
      expect(TalaRepository.getByAksharas).toHaveBeenCalledWith(6, undefined, undefined);
      expect(result.items[0].name).toBe('Rupaka Tala');

      // Test search by type
      result = await TalaService.searchTalas({ type: 'chapu' });
      expect(TalaRepository.getByType).toHaveBeenCalledWith('Chapu', undefined, undefined);
      expect(result.items[0].name).toBe('Misra Chapu');

      // Test search by tradition
      result = await TalaService.searchTalas({ tradition: Tradition.CARNATIC });
      expect(TalaRepository.getByTradition).toHaveBeenCalledWith(
        Tradition.CARNATIC,
        undefined,
        undefined
      );
      expect(result.items[0].name).toBe('Khanda Jati Triputa');

      // Test empty search parameters
      result = await TalaService.searchTalas({});
      expect(result.items).toHaveLength(0);
    });
  });

  describe('normalizeType', () => {
    it('should normalize common tala types', async () => {
      // Test private method by calling updateTala which uses it internally
      const updateInput: UpdateTalaInput = {
        type: 'misra',
        editorId: 'user-123',
      };

      vi.mocked(TalaRepository.update).mockResolvedValue({} as any);

      await TalaService.updateTala('test-id', updateInput);

      // Check that type was normalized
      expect(TalaRepository.update).toHaveBeenCalledWith('test-id', {
        type: 'Misra',
        editorId: 'user-123',
      });
    });
  });
});
