import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCompositionTala,
  deleteCompositionTala,
  getCompositionTalas,
  getCompositionsByTala,
} from './index';
import type { CreateCompositionTalaInput } from './index';

vi.mock('./entity', () => ({
  CompositionTalaEntity: {
    create: vi.fn(),
    query: {
      primary: vi.fn(),
      byTala: vi.fn(),
    },
    delete: vi.fn(),
  },
}));

describe('CompositionTala', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCompositionTala', () => {
    it('should create composition-tala relationship', async () => {
      const input: CreateCompositionTalaInput = {
        compositionId: 'comp-123',
        talaId: 'tala-456',
      };

      const mockRelationship = {
        compositionId: 'comp-123',
        talaId: 'tala-456',
        createdAt: '2025-01-09T00:00:00.000Z',
      };

      const { CompositionTalaEntity } = await import('./entity');
      vi.mocked(CompositionTalaEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockRelationship }),
      } as any);

      const result = await createCompositionTala(input);

      expect(CompositionTalaEntity.create).toHaveBeenCalledWith(input);
      expect(result).toEqual(mockRelationship);
    });

    it('should throw error when creation fails', async () => {
      const input: CreateCompositionTalaInput = {
        compositionId: 'comp-123',
        talaId: 'tala-456',
      };

      const { CompositionTalaEntity } = await import('./entity');
      vi.mocked(CompositionTalaEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      await expect(createCompositionTala(input)).rejects.toThrow(
        'Failed to create composition-tala relationship'
      );
    });
  });

  describe('getCompositionTalas', () => {
    it('should return talas for composition', async () => {
      const mockRelationships = [
        {
          compositionId: 'comp-123',
          talaId: 'tala-456',
          createdAt: '2025-01-09T00:00:00.000Z',
        },
        {
          compositionId: 'comp-123',
          talaId: 'tala-789',
          createdAt: '2025-01-09T00:00:00.000Z',
        },
      ];

      const { CompositionTalaEntity } = await import('./entity');
      vi.mocked(CompositionTalaEntity.query.primary).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockRelationships }),
      } as any);

      const result = await getCompositionTalas('comp-123');

      expect(CompositionTalaEntity.query.primary).toHaveBeenCalledWith({
        compositionId: 'comp-123',
      });
      expect(result).toEqual({
        items: mockRelationships,
        nextToken: undefined,
        hasMore: false,
      });
    });
  });

  describe('getCompositionsByTala', () => {
    it('should return compositions for tala', async () => {
      const mockRelationships = [
        {
          compositionId: 'comp-123',
          talaId: 'tala-456',
          createdAt: '2025-01-09T00:00:00.000Z',
        },
        {
          compositionId: 'comp-789',
          talaId: 'tala-456',
          createdAt: '2025-01-09T00:00:00.000Z',
        },
      ];

      const { CompositionTalaEntity } = await import('./entity');
      vi.mocked(CompositionTalaEntity.query.byTala).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockRelationships }),
      } as any);

      const result = await getCompositionsByTala('tala-456');

      expect(CompositionTalaEntity.query.byTala).toHaveBeenCalledWith({ talaId: 'tala-456' });
      expect(result).toEqual({
        items: mockRelationships,
        nextToken: undefined,
        hasMore: false,
      });
    });
  });

  describe('deleteCompositionTala', () => {
    it('should delete composition-tala relationship', async () => {
      const { CompositionTalaEntity } = await import('./entity');
      vi.mocked(CompositionTalaEntity.delete).mockReturnValue({
        go: vi.fn().mockResolvedValue({}),
      } as any);

      await expect(deleteCompositionTala('comp-123', 'tala-456')).resolves.not.toThrow();

      expect(CompositionTalaEntity.delete).toHaveBeenCalledWith({
        compositionId: 'comp-123',
        talaId: 'tala-456',
      });
    });
  });
});
