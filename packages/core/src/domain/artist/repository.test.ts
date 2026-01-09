import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtistRepository } from './repository';
import { CreateArtistInput } from './types';

// Mock the utils module
vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'test-id-123'),
}));

// Mock the entities
vi.mock('../../db/entities', () => ({
  ArtistEntity: {
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('ArtistRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create artist with generated ID and timestamps', async () => {
      const input: CreateArtistInput = {
        name: 'M.S. Subbulakshmi',
      };

      const mockArtist = {
        id: 'test-id-123',
        ...input,
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { ArtistEntity } = await import('../../db/entities');
      vi.mocked(ArtistEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockArtist }),
      } as any);

      const artist = await ArtistRepository.create(input);

      expect(ArtistEntity.create).toHaveBeenCalledWith({
        id: 'test-id-123',
        ...input,
      });
      expect(artist).toEqual(mockArtist);
    });
  });

  describe('getById', () => {
    it('should return artist when found', async () => {
      const mockArtist = {
        id: 'test-id-123',
        name: 'Test Artist',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { ArtistEntity } = await import('../../db/entities');
      vi.mocked(ArtistEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockArtist }),
      } as any);

      const artist = await ArtistRepository.getById('test-id-123');

      expect(ArtistEntity.get).toHaveBeenCalledWith({ id: 'test-id-123' });
      expect(artist).toEqual(mockArtist);
    });

    it('should return null when artist not found', async () => {
      const { ArtistEntity } = await import('../../db/entities');
      vi.mocked(ArtistEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      const artist = await ArtistRepository.getById('non-existent-id');

      expect(artist).toBeNull();
    });
  });

  describe('update', () => {
    it('should update artist successfully', async () => {
      const updateInput = { name: 'Updated Name' };
      const mockUpdatedArtist = {
        id: 'test-id-123',
        name: 'Updated Name',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T01:00:00.000Z',
      };

      const { ArtistEntity } = await import('../../db/entities');
      vi.mocked(ArtistEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: mockUpdatedArtist }),
        }),
      } as any);

      const artist = await ArtistRepository.update('test-id-123', updateInput);

      expect(ArtistEntity.update).toHaveBeenCalledWith({ id: 'test-id-123' });
      expect(artist).toEqual(mockUpdatedArtist);
    });
  });

  describe('delete', () => {
    it('should delete artist successfully', async () => {
      const { ArtistEntity } = await import('../../db/entities');
      vi.mocked(ArtistEntity.delete).mockReturnValue({
        go: vi.fn().mockResolvedValue({}),
      } as any);

      const result = await ArtistRepository.delete('test-id-123');

      expect(ArtistEntity.delete).toHaveBeenCalledWith({ id: 'test-id-123' });
      expect(result).toBe(true);
    });
  });
});
