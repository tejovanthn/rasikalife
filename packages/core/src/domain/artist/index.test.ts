import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createArtist, deleteArtist, getArtist, updateArtist, listArtists } from '.';
import type { CreateArtistInput } from '.';

vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'test-id-123'),
}));

vi.mock('./entity', () => ({
  ArtistEntity: {
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    scan: {
      go: vi.fn(),
    },
    query: {
      byName: vi.fn(),
    },
  },
}));

describe('Artist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createArtist', () => {
    it('should create artist with generated ID and timestamps', async () => {
      const input: CreateArtistInput = {
        name: 'M.S. Subbulakshmi',
      };

      const mockArtist = {
        id: 'test-id-123',
        ...input,
        artistType: 'Artist',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { ArtistEntity } = await import('./entity');
      vi.mocked(ArtistEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockArtist }),
      } as any);

      const artist = await createArtist(input);

      expect(ArtistEntity.create).toHaveBeenCalledWith({
        id: 'test-id-123',
        ...input,
      });
      expect(artist).toEqual(mockArtist);
    });

    it('should throw error when creation fails', async () => {
      const input: CreateArtistInput = { name: 'Test Artist' };

      const { ArtistEntity } = await import('./entity');
      vi.mocked(ArtistEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      await expect(createArtist(input)).rejects.toThrow('Failed to create artist');
    });
  });

  describe('getArtist', () => {
    it('should return artist when found', async () => {
      const mockArtist = {
        id: 'test-id-123',
        name: 'Test Artist',
        artistType: 'Artist',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { ArtistEntity } = await import('./entity');
      vi.mocked(ArtistEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockArtist }),
      } as any);

      const artist = await getArtist('test-id-123');

      expect(ArtistEntity.get).toHaveBeenCalledWith({ id: 'test-id-123' });
      expect(artist).toEqual(mockArtist);
    });

    it('should return null when artist not found', async () => {
      const { ArtistEntity } = await import('./entity');
      vi.mocked(ArtistEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      const artist = await getArtist('non-existent-id');

      expect(artist).toBeNull();
    });
  });

  describe('updateArtist', () => {
    it('should update artist successfully', async () => {
      const updateInput = { name: 'Updated Name' };
      const mockUpdatedArtist = {
        id: 'test-id-123',
        name: 'Updated Name',
        artistType: 'Artist',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T01:00:00.000Z',
      };

      const { ArtistEntity } = await import('./entity');
      vi.mocked(ArtistEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: mockUpdatedArtist }),
        }),
      } as any);

      const artist = await updateArtist('test-id-123', updateInput);

      expect(ArtistEntity.update).toHaveBeenCalledWith({ id: 'test-id-123' });
      expect(artist).toEqual(mockUpdatedArtist);
    });

    it('should throw error when update fails', async () => {
      const updateInput = { name: 'Updated Name' };

      const { ArtistEntity } = await import('./entity');
      vi.mocked(ArtistEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: null }),
        }),
      } as any);

      await expect(updateArtist('test-id-123', updateInput)).rejects.toThrow(
        'Artist test-id-123 not found'
      );
    });
  });

  describe('deleteArtist', () => {
    it('should delete artist successfully', async () => {
      const { ArtistEntity } = await import('./entity');
      vi.mocked(ArtistEntity.delete).mockReturnValue({
        go: vi.fn().mockResolvedValue({}),
      } as any);

      await expect(deleteArtist('test-id-123')).resolves.not.toThrow();

      expect(ArtistEntity.delete).toHaveBeenCalledWith({ id: 'test-id-123' });
    });
  });

  describe('listArtists', () => {
    it('should return paginated artists', async () => {
      const mockArtists = [
        {
          id: 'artist-1',
          name: 'Artist 1',
          createdAt: '2025-01-09T00:00:00.000Z',
          updatedAt: '2025-01-09T00:00:00.000Z',
        },
        {
          id: 'artist-2',
          name: 'Artist 2',
          createdAt: '2025-01-09T00:00:00.000Z',
          updatedAt: '2025-01-09T00:00:00.000Z',
        },
      ];

      const { ArtistEntity } = await import('./entity');
      vi.mocked(ArtistEntity.scan.go).mockResolvedValue({
        data: mockArtists,
        cursor: 'next-token-123',
      });

      const result = await listArtists({ limit: 10, nextToken: 'prev-token' });

      expect(result).toEqual({
        items: mockArtists,
        nextToken: 'next-token-123',
        hasMore: true,
      });
    });

    it('should return empty result when no artists found', async () => {
      const { ArtistEntity } = await import('./entity');
      vi.mocked(ArtistEntity.scan.go).mockResolvedValue({
        data: [],
        cursor: null,
      });

      const result = await listArtists();

      expect(result).toEqual({
        items: [],
        nextToken: undefined,
        hasMore: false,
      });
    });

    it('should use default limit when not specified', async () => {
      const { ArtistEntity } = await import('./entity');
      vi.mocked(ArtistEntity.scan.go).mockResolvedValue({
        data: [],
        cursor: null,
      });

      await listArtists();
    });
  });
});
