import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompositionRepository } from './repository';
import { CreateCompositionInput } from './types';

// Mock the utils module
vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'test-composition-id'),
}));

// Mock the entities
vi.mock('../../db/entities', () => ({
  CompositionEntity: {
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      byArtist: vi.fn(() => ({
        go: vi.fn(),
      })),
    },
  },
}));

describe('CompositionRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create composition with generated ID and timestamps', async () => {
      const input: CreateCompositionInput = {
        title: 'Bhaja Govindam',
        artistId: 'artist-123',
      };

      const mockComposition = {
        id: 'test-composition-id',
        ...input,
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { CompositionEntity } = await import('../../db/entities');
      vi.mocked(CompositionEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockComposition }),
      } as any);

      const composition = await CompositionRepository.create(input);

      expect(CompositionEntity.create).toHaveBeenCalledWith({
        id: 'test-composition-id',
        ...input,
      });
      expect(composition).toEqual(mockComposition);
    });
  });

  describe('getById', () => {
    it('should return composition when found', async () => {
      const mockComposition = {
        id: 'test-composition-id',
        title: 'Test Composition',
        artistId: 'artist-123',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { CompositionEntity } = await import('../../db/entities');
      vi.mocked(CompositionEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockComposition }),
      } as any);

      const composition = await CompositionRepository.getById('test-composition-id');

      expect(CompositionEntity.get).toHaveBeenCalledWith({ id: 'test-composition-id' });
      expect(composition).toEqual(mockComposition);
    });

    it('should return null when composition not found', async () => {
      const { CompositionEntity } = await import('../../db/entities');
      vi.mocked(CompositionEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      const composition = await CompositionRepository.getById('non-existent-id');

      expect(composition).toBeNull();
    });
  });

  describe('getByArtistId', () => {
    it('should return compositions by artist ID', async () => {
      const mockCompositions = [
        {
          id: 'comp-1',
          title: 'Composition 1',
          artistId: 'artist-123',
          createdAt: '2025-01-09T00:00:00.000Z',
          updatedAt: '2025-01-09T00:00:00.000Z',
        },
        {
          id: 'comp-2',
          title: 'Composition 2',
          artistId: 'artist-123',
          createdAt: '2025-01-09T01:00:00.000Z',
          updatedAt: '2025-01-09T01:00:00.000Z',
        },
      ];

      const { CompositionEntity } = await import('../../db/entities');
      vi.mocked(CompositionEntity.query.byArtist).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockCompositions }),
      } as any);

      const compositions = await CompositionRepository.getByArtistId('artist-123');

      expect(CompositionEntity.query.byArtist).toHaveBeenCalledWith({ artistId: 'artist-123' });
      expect(compositions).toEqual(mockCompositions);
    });
  });

  describe('update', () => {
    it('should update composition successfully', async () => {
      const updateInput = { title: 'Updated Title' };
      const mockUpdatedComposition = {
        id: 'test-composition-id',
        title: 'Updated Title',
        artistId: 'artist-123',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T01:00:00.000Z',
      };

      const { CompositionEntity } = await import('../../db/entities');
      vi.mocked(CompositionEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: mockUpdatedComposition }),
        }),
      } as any);

      const composition = await CompositionRepository.update('test-composition-id', updateInput);

      expect(CompositionEntity.update).toHaveBeenCalledWith({ id: 'test-composition-id' });
      expect(composition).toEqual(mockUpdatedComposition);
    });
  });

  describe('delete', () => {
    it('should delete composition successfully', async () => {
      const { CompositionEntity } = await import('../../db/entities');
      vi.mocked(CompositionEntity.delete).mockReturnValue({
        go: vi.fn().mockResolvedValue({}),
      } as any);

      const result = await CompositionRepository.delete('test-composition-id');

      expect(CompositionEntity.delete).toHaveBeenCalledWith({ id: 'test-composition-id' });
      expect(result).toBe(true);
    });
  });
});
