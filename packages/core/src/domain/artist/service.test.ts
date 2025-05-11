import { vi, describe, beforeEach, it, expect } from 'vitest';
import { ArtistRepository } from './repository';
import { ArtistService } from './service';
import { ArtistType, Tradition } from './types';
import * as db from '../../db';

// Mock the repository
vi.mock('./repository');
vi.mock('../../db');

describe('ArtistService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createArtist', () => {
    it('should create an artist through repository', async () => {
      const input = {
        name: 'Test Artist',
        artistType: ArtistType.VOCALIST,
        instruments: ['voice'],
        traditions: [Tradition.CARNATIC],
      };

      const mockArtist = { ...input, id: 'test-id' };
      vi.mocked(ArtistRepository.create).mockResolvedValue(mockArtist as any);

      const result = await ArtistService.createArtist(input);

      expect(result).toEqual(mockArtist);
      expect(ArtistRepository.create).toHaveBeenCalledWith(input);
    });
  });

  describe('getArtist', () => {
    it('should get artist by ID', async () => {
      const mockArtist = { id: 'test-id', name: 'Test Artist' };
      vi.mocked(ArtistRepository.getById).mockResolvedValue(mockArtist as any);

      const result = await ArtistService.getArtist('test-id');

      expect(result).toEqual(mockArtist);
      expect(ArtistRepository.getById).toHaveBeenCalledWith('test-id');
    });

    it('should return null for non-existent artist', async () => {
      vi.mocked(ArtistRepository.getById).mockResolvedValue(null);

      const result = await ArtistService.getArtist('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateArtist', () => {
    it('should update existing artist', async () => {
      const existingArtist = { id: 'test-id', name: 'Old Name' };
      const updateInput = { name: 'New Name' };
      const updatedArtist = { ...existingArtist, ...updateInput };

      vi.mocked(ArtistRepository.getById).mockResolvedValue(existingArtist as any);
      vi.mocked(ArtistRepository.update).mockResolvedValue(updatedArtist as any);

      const result = await ArtistService.updateArtist('test-id', updateInput);

      expect(result).toEqual(updatedArtist);
      expect(ArtistRepository.update).toHaveBeenCalledWith('test-id', updateInput);
    });

    it('should throw error for non-existent artist', async () => {
      vi.mocked(ArtistRepository.getById).mockResolvedValue(null);

      await expect(
        ArtistService.updateArtist('non-existent', { name: 'New Name' })
      ).rejects.toThrow('Artist non-existent not found');
    });
  });

  describe('searchArtists', () => {
    it('should search through repository', async () => {
      const searchParams = { query: 'test', tradition: Tradition.CARNATIC };
      const mockResults = { items: [], hasMore: false };

      vi.mocked(ArtistRepository.search).mockResolvedValue(mockResults);

      const result = await ArtistService.searchArtists(searchParams);

      expect(result).toEqual(mockResults);
      expect(ArtistRepository.search).toHaveBeenCalledWith(searchParams);
    });
  });

  describe('getPopularArtists', () => {
    it('should get popular artists using GSI', async () => {
      const mockArtists = [
        { id: '1', name: 'Popular 1', popularityScore: 100 },
        { id: '2', name: 'Popular 2', popularityScore: 90 },
      ];

      const mockQuery = {
        withIndex: vi.fn().mockReturnThis(),
        withPartitionKey: vi.fn().mockReturnThis(),
        withSortOrder: vi.fn().mockReturnThis(),
        withLimit: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ items: mockArtists }),
      };

      vi.mocked(db.createQuery).mockReturnValue(mockQuery as any);

      const result = await ArtistService.getPopularArtists(2);

      expect(result).toEqual(mockArtists);
      expect(mockQuery.withIndex).toHaveBeenCalledWith('GSI3');
      expect(mockQuery.withPartitionKey).toHaveBeenCalledWith('GSI3PK', 'POPULARITY');
      expect(mockQuery.withSortOrder).toHaveBeenCalledWith(false);
      expect(mockQuery.withLimit).toHaveBeenCalledWith(2);
    });
  });

  describe('incrementViewCount', () => {
    it('should increment view count', async () => {
      vi.mocked(ArtistRepository.update).mockResolvedValue({} as any);

      await ArtistService.incrementViewCount('test-id');

      expect(ArtistRepository.update).toHaveBeenCalledWith('test-id', {
        viewCount: { $increment: 1 },
      });
    });
  });
});
