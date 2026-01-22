import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createComposition,
  deleteComposition,
  getComposition,
  getCompositionsByComposer,
  updateComposition,
} from './index';
import type { CreateCompositionInput, UpdateCompositionInput } from './index';

// Mock dependencies
vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'test-composition-id'),
}));

vi.mock('../artist', () => ({
  getArtist: vi.fn(),
}));

vi.mock('../raga', () => ({
  getRaga: vi.fn(),
}));

vi.mock('../tala', () => ({
  getTala: vi.fn(),
}));

vi.mock('../composition_raga', () => ({
  createCompositionRaga: vi.fn(),
  deleteCompositionRaga: vi.fn(),
  getCompositionRagas: vi.fn(),
}));

vi.mock('../composition_tala', () => ({
  createCompositionTala: vi.fn(),
  deleteCompositionTala: vi.fn(),
  getCompositionTalas: vi.fn(),
}));

vi.mock('./entity', () => ({
  CompositionEntity: {
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      byComposer: vi.fn(),
    },
  },
}));

describe('Composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createComposition', () => {
    it('should create composition with denormalized data and junction records', async () => {
      const input: CreateCompositionInput = {
        title: 'Raga Bhairavi',
        composer: { id: 'artist-123', name: 'Test Artist' },
        language: 'Sanskrit',
        lyricsV1: [],
        ragaIds: ['raga-456'],
        talaIds: ['tala-789'],
      };

      const mockRaga = { id: 'raga-456', name: 'Bhairavi' };
      const mockTala = { id: 'tala-789', name: 'Adi' };

      const mockComposition = {
        id: 'test-composition-id',
        title: 'Raga Bhairavi',
        composerId: 'artist-123',
        composer: { id: 'artist-123', name: 'Test Artist' },
        language: 'Sanskrit',
        lyricsV1: [],
        ragas: [{ id: 'raga-456', name: 'Bhairavi' }],
        talas: [{ id: 'tala-789', name: 'Adi' }],
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      // Mock dependencies
      const { getRaga } = await import('../raga');
      const { getTala } = await import('../tala');
      const { createCompositionRaga } = await import('../composition_raga');
      const { createCompositionTala } = await import('../composition_tala');
      const { CompositionEntity } = await import('./entity');

      vi.mocked(getRaga).mockResolvedValue(mockRaga);
      vi.mocked(getTala).mockResolvedValue(mockTala);
      vi.mocked(createCompositionRaga).mockResolvedValue({} as any);
      vi.mocked(createCompositionTala).mockResolvedValue({} as any);

      vi.mocked(CompositionEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockComposition }),
      } as any);

      const result = await createComposition(input);

      expect(CompositionEntity.create).toHaveBeenCalledWith({
        id: 'test-composition-id',
        title: 'Raga Bhairavi',
        composerId: 'artist-123',
        composer: { id: 'artist-123', name: 'Test Artist' },
        language: 'Sanskrit',
        lyricsV1: [],
        ragas: [{ id: 'raga-456', name: 'Bhairavi' }],
        talas: [{ id: 'tala-789', name: 'Adi' }],
      });

      expect(createCompositionRaga).toHaveBeenCalledWith({
        compositionId: 'test-composition-id',
        ragaId: 'raga-456',
      });

      expect(createCompositionTala).toHaveBeenCalledWith({
        compositionId: 'test-composition-id',
        talaId: 'tala-789',
      });

      expect(result).toEqual(mockComposition);
    });

    it('should create composition without relationships', async () => {
      const input: CreateCompositionInput = {
        title: 'Simple Composition',
        composer: { id: 'artist-123', name: 'Test Artist' },
        language: 'Tamil',
        lyricsV1: [],
      };

      const mockComposition = {
        id: 'test-composition-id',
        title: 'Simple Composition',
        composerId: 'artist-123',
        composer: { id: 'artist-123', name: 'Test Artist' },
        language: 'Tamil',
        lyricsV1: [],
        ragas: [],
        talas: [],
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { CompositionEntity } = await import('./entity');

      vi.mocked(CompositionEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockComposition }),
      } as any);

      const result = await createComposition(input);

      expect(CompositionEntity.create).toHaveBeenCalledWith({
        id: 'test-composition-id',
        title: 'Simple Composition',
        composerId: 'artist-123',
        composer: { id: 'artist-123', name: 'Test Artist' },
        language: 'Tamil',
        lyricsV1: [],
        ragas: [],
        talas: [],
      });

      expect(result).toEqual(mockComposition);
    });

    it('should throw error when creation fails', async () => {
      const input: CreateCompositionInput = {
        title: 'Test Composition',
        composer: { id: 'artist-123', name: 'Test Artist' },
        language: 'Tamil',
        lyricsV1: [],
      };

      const mockArtist = { id: 'artist-123', name: 'Test Artist' };

      const { getArtist } = await import('../artist');
      const { CompositionEntity } = await import('./entity');

      vi.mocked(getArtist).mockResolvedValue(mockArtist);
      vi.mocked(CompositionEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      await expect(createComposition(input)).rejects.toThrow('Failed to create composition');
    });
  });

  describe('getComposition', () => {
    it('should return composition with relations when found', async () => {
      const mockComposition = {
        id: 'comp-123',
        title: 'Test Composition',
        composerId: 'artist-123',
        composer: { id: 'artist-123', name: 'Test Artist' },
        language: 'Sanskrit',
        lyricsV1: [],
        ragas: [{ id: 'raga-456', name: 'Bhairavi' }],
        talas: [{ id: 'tala-789', name: 'Adi' }],
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { CompositionEntity } = await import('./entity');
      vi.mocked(CompositionEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockComposition }),
      } as any);

      const result = await getComposition('comp-123');

      expect(CompositionEntity.get).toHaveBeenCalledWith({ id: 'comp-123' });
      expect(result).toEqual({
        id: 'comp-123',
        title: 'Test Composition',
        composer: { id: 'artist-123', name: 'Test Artist' },
        language: 'Sanskrit',
        lyricsV1: [],
        ragas: [{ id: 'raga-456', name: 'Bhairavi' }],
        talas: [{ id: 'tala-789', name: 'Adi' }],
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      });
    });

    it('should return null when composition not found', async () => {
      const { CompositionEntity } = await import('./entity');
      vi.mocked(CompositionEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      const result = await getComposition('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getCompositionsByComposer', () => {
    it('should return compositions for given composer', async () => {
      const mockCompositions = [
        {
          id: 'comp-1',
          title: 'Composition 1',
          composerId: 'artist-123',
          composer: { id: 'artist-123', name: 'Test Artist' },
          language: 'Tamil',
          lyricsV1: [],
          ragas: [],
          talas: [],
          createdAt: '2025-01-09T00:00:00.000Z',
          updatedAt: '2025-01-09T00:00:00.000Z',
        },
      ];

      const { CompositionEntity } = await import('./entity');
      vi.mocked(CompositionEntity.query.byComposer).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockCompositions }),
      } as any);

      const result = await getCompositionsByComposer('artist-123');

      expect(CompositionEntity.query.byComposer).toHaveBeenCalledWith({ composerId: 'artist-123' });
      expect(result).toEqual({
        items: [
          {
            id: 'comp-1',
            title: 'Composition 1',
            composer: { id: 'artist-123', name: 'Test Artist' },
            language: 'Tamil',
            lyricsV1: [],
            ragas: [],
            talas: [],
            sourceAttribution: undefined,
            createdAt: '2025-01-09T00:00:00.000Z',
            updatedAt: '2025-01-09T00:00:00.000Z',
          },
        ],
        nextToken: undefined,
        hasMore: false,
      });
    });

    it('should return empty array when no compositions found', async () => {
      const { CompositionEntity } = await import('./entity');
      vi.mocked(CompositionEntity.query.byComposer).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: [] }),
      } as any);

      const result = await getCompositionsByComposer('artist-123');

      expect(result).toEqual({
        items: [],
        nextToken: undefined,
        hasMore: false,
      });
    });
  });

  describe('updateComposition', () => {
    it('should update composition and handle relationship changes', async () => {
      const updateInput: UpdateCompositionInput = {
        title: 'Updated Title',
        ragaIds: ['raga-new'],
        talaIds: ['tala-new'],
      };

      const existingRagas = [
        { compositionId: 'comp-123', ragaId: 'raga-old', createdAt: '2025-01-09T00:00:00.000Z' },
      ];
      const existingTalas = [
        { compositionId: 'comp-123', talaId: 'tala-old', createdAt: '2025-01-09T00:00:00.000Z' },
      ];

      const mockUpdatedComposition = {
        id: 'comp-123',
        title: 'Updated Title',
        artistId: 'artist-123',
        artistName: 'Test Artist',
        ragas: [],
        talas: [],
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T01:00:00.000Z',
      };

      const { getCompositionRagas, deleteCompositionRaga, createCompositionRaga } = await import(
        '../composition_raga'
      );
      const { getCompositionTalas, deleteCompositionTala, createCompositionTala } = await import(
        '../composition_tala'
      );
      const { CompositionEntity } = await import('./entity');

      vi.mocked(getCompositionRagas).mockResolvedValue({
        items: existingRagas,
        hasMore: false,
      });
      vi.mocked(getCompositionTalas).mockResolvedValue({
        items: existingTalas,
        hasMore: false,
      });
      vi.mocked(deleteCompositionRaga).mockResolvedValue(undefined);
      vi.mocked(deleteCompositionTala).mockResolvedValue(undefined);
      vi.mocked(createCompositionRaga).mockResolvedValue({} as any);
      vi.mocked(createCompositionTala).mockResolvedValue({} as any);

      vi.mocked(CompositionEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: mockUpdatedComposition }),
        }),
      } as any);

      const result = await updateComposition('comp-123', updateInput);

      expect(deleteCompositionRaga).toHaveBeenCalledWith('comp-123', 'raga-old');
      expect(createCompositionRaga).toHaveBeenCalledWith({
        compositionId: 'comp-123',
        ragaId: 'raga-new',
      });

      expect(deleteCompositionTala).toHaveBeenCalledWith('comp-123', 'tala-old');
      expect(createCompositionTala).toHaveBeenCalledWith({
        compositionId: 'comp-123',
        talaId: 'tala-new',
      });

      expect(result).toEqual(mockUpdatedComposition);
    });

    it('should throw error when update fails', async () => {
      const updateInput: UpdateCompositionInput = { title: 'Updated Title' };

      const { CompositionEntity } = await import('./entity');
      vi.mocked(CompositionEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: null }),
        }),
      } as any);

      await expect(updateComposition('comp-123', updateInput)).rejects.toThrow(
        'Composition comp-123 not found'
      );
    });
  });

  describe('deleteComposition', () => {
    it('should delete composition and cleanup junction records', async () => {
      const existingRagas = [
        { compositionId: 'comp-123', ragaId: 'raga-456', createdAt: '2025-01-09T00:00:00.000Z' },
      ];
      const existingTalas = [
        { compositionId: 'comp-123', talaId: 'tala-789', createdAt: '2025-01-09T00:00:00.000Z' },
      ];

      const { getCompositionRagas, deleteCompositionRaga } = await import('../composition_raga');
      const { getCompositionTalas, deleteCompositionTala } = await import('../composition_tala');
      const { CompositionEntity } = await import('./entity');

      vi.mocked(getCompositionRagas).mockResolvedValue({
        items: existingRagas,
        hasMore: false,
      });
      vi.mocked(getCompositionTalas).mockResolvedValue({
        items: existingTalas,
        hasMore: false,
      });
      vi.mocked(deleteCompositionRaga).mockResolvedValue(undefined);
      vi.mocked(deleteCompositionTala).mockResolvedValue(undefined);
      vi.mocked(CompositionEntity.delete).mockReturnValue({
        go: vi.fn().mockResolvedValue({}),
      } as any);

      await expect(deleteComposition('comp-123')).resolves.not.toThrow();

      expect(deleteCompositionRaga).toHaveBeenCalledWith('comp-123', 'raga-456');
      expect(deleteCompositionTala).toHaveBeenCalledWith('comp-123', 'tala-789');
      expect(CompositionEntity.delete).toHaveBeenCalledWith({ id: 'comp-123' });
    });
  });
});
