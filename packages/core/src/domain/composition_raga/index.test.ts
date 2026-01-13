import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCompositionRaga,
  getCompositionRagas,
  getCompositionsByRaga,
  deleteCompositionRaga,
} from './index';
import type { CreateCompositionRagaInput } from './index';

vi.mock('./entity', () => ({
  CompositionRagaEntity: {
    create: vi.fn(),
    query: {
      primary: vi.fn(),
      byRaga: vi.fn(),
    },
    delete: vi.fn(),
  },
}));

describe('CompositionRaga', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCompositionRaga', () => {
    it('should create composition-raga relationship', async () => {
      const input: CreateCompositionRagaInput = {
        compositionId: 'comp-123',
        ragaId: 'raga-456',
      };

      const mockRelationship = {
        compositionId: 'comp-123',
        ragaId: 'raga-456',
        createdAt: '2025-01-09T00:00:00.000Z',
      };

      const { CompositionRagaEntity } = await import('./entity');
      vi.mocked(CompositionRagaEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockRelationship }),
      } as any);

      const result = await createCompositionRaga(input);

      expect(CompositionRagaEntity.create).toHaveBeenCalledWith(input);
      expect(result).toEqual(mockRelationship);
    });

    it('should throw error when creation fails', async () => {
      const input: CreateCompositionRagaInput = {
        compositionId: 'comp-123',
        ragaId: 'raga-456',
      };

      const { CompositionRagaEntity } = await import('./entity');
      vi.mocked(CompositionRagaEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      await expect(createCompositionRaga(input)).rejects.toThrow(
        'Failed to create composition-raga relationship'
      );
    });
  });

  describe('getCompositionRagas', () => {
    it('should return ragas for composition', async () => {
      const mockRelationships = [
        {
          compositionId: 'comp-123',
          ragaId: 'raga-456',
          createdAt: '2025-01-09T00:00:00.000Z',
        },
        {
          compositionId: 'comp-123',
          ragaId: 'raga-789',
          createdAt: '2025-01-09T00:00:00.000Z',
        },
      ];

      const { CompositionRagaEntity } = await import('./entity');
      vi.mocked(CompositionRagaEntity.query.primary).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockRelationships }),
      } as any);

      const result = await getCompositionRagas('comp-123');

      expect(CompositionRagaEntity.query.primary).toHaveBeenCalledWith({
        compositionId: 'comp-123',
      });
      expect(result).toEqual({
        items: mockRelationships,
        nextToken: undefined,
        hasMore: false,
      });
    });

    it('should return empty array when no relationships found', async () => {
      const { CompositionRagaEntity } = await import('./entity');
      vi.mocked(CompositionRagaEntity.query.primary).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: [] }),
      } as any);

      const result = await getCompositionRagas('comp-123');

      expect(result).toEqual({
        items: [],
        nextToken: undefined,
        hasMore: false,
      });
    });
  });

  describe('getCompositionsByRaga', () => {
    it('should return compositions for raga', async () => {
      const mockRelationships = [
        {
          compositionId: 'comp-123',
          ragaId: 'raga-456',
          createdAt: '2025-01-09T00:00:00.000Z',
        },
        {
          compositionId: 'comp-789',
          ragaId: 'raga-456',
          createdAt: '2025-01-09T00:00:00.000Z',
        },
      ];

      const { CompositionRagaEntity } = await import('./entity');
      vi.mocked(CompositionRagaEntity.query.byRaga).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockRelationships }),
      } as any);

      const result = await getCompositionsByRaga('raga-456');

      expect(CompositionRagaEntity.query.byRaga).toHaveBeenCalledWith({ ragaId: 'raga-456' });
      expect(result).toEqual({
        items: mockRelationships,
        nextToken: undefined,
        hasMore: false,
      });
    });
  });

  describe('deleteCompositionRaga', () => {
    it('should delete composition-raga relationship', async () => {
      const { CompositionRagaEntity } = await import('./entity');
      vi.mocked(CompositionRagaEntity.delete).mockReturnValue({
        go: vi.fn().mockResolvedValue({}),
      } as any);

      await expect(deleteCompositionRaga('comp-123', 'raga-456')).resolves.not.toThrow();

      expect(CompositionRagaEntity.delete).toHaveBeenCalledWith({
        compositionId: 'comp-123',
        ragaId: 'raga-456',
      });
    });
  });
});
