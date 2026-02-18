import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFestival, deleteFestival, getFestival, listFestivals, updateFestival } from '.';
import type { CreateFestivalInput } from '.';

vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'test-id-123'),
}));

vi.mock('./entity', () => ({
  FestivalEntity: {
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      byStatus: vi.fn(),
    },
  },
}));

describe('Festival', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createFestival', () => {
    it('should create festival with generated ID and userId', async () => {
      const input: CreateFestivalInput = {
        name: 'Kritajnata 2026',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
        tags: ['bharatanatyam', 'kuchipudi'],
      };

      const mockFestival = {
        id: 'test-id-123',
        ...input,
        status: 'draft',
        createdBy: 'user-1',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { FestivalEntity } = await import('./entity');
      vi.mocked(FestivalEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockFestival }),
      } as any);

      const festival = await createFestival(input, 'user-1');

      expect(FestivalEntity.create).toHaveBeenCalledWith({
        id: 'test-id-123',
        ...input,
        status: 'draft',
        createdBy: 'user-1',
      });
      expect(festival).toEqual(mockFestival);
    });

    it('should throw error when creation fails', async () => {
      const input: CreateFestivalInput = {
        name: 'Test Festival',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
      };

      const { FestivalEntity } = await import('./entity');
      vi.mocked(FestivalEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      await expect(createFestival(input, 'user-1')).rejects.toThrow('Failed to create festival');
    });
  });

  describe('getFestival', () => {
    it('should return festival when found', async () => {
      const mockFestival = {
        id: 'test-id-123',
        name: 'Kritajnata 2026',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
        status: 'approved',
        createdBy: 'user-1',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { FestivalEntity } = await import('./entity');
      vi.mocked(FestivalEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockFestival }),
      } as any);

      const festival = await getFestival('test-id-123');

      expect(FestivalEntity.get).toHaveBeenCalledWith({ id: 'test-id-123' });
      expect(festival).toEqual(mockFestival);
    });

    it('should return null when festival not found', async () => {
      const { FestivalEntity } = await import('./entity');
      vi.mocked(FestivalEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      const festival = await getFestival('non-existent-id');

      expect(festival).toBeNull();
    });
  });

  describe('updateFestival', () => {
    it('should update festival successfully', async () => {
      const updateInput = { name: 'Updated Festival' };
      const mockUpdatedFestival = {
        id: 'test-id-123',
        name: 'Updated Festival',
        startDate: '2026-02-19',
        endDate: '2026-02-19',
        status: 'draft',
        createdBy: 'user-1',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T01:00:00.000Z',
      };

      const { FestivalEntity } = await import('./entity');
      vi.mocked(FestivalEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: mockUpdatedFestival }),
        }),
      } as any);

      const festival = await updateFestival('test-id-123', updateInput);

      expect(FestivalEntity.update).toHaveBeenCalledWith({ id: 'test-id-123' });
      expect(festival).toEqual(mockUpdatedFestival);
    });

    it('should throw error when update fails', async () => {
      const updateInput = { name: 'Updated Festival' };

      const { FestivalEntity } = await import('./entity');
      vi.mocked(FestivalEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: null }),
        }),
      } as any);

      await expect(updateFestival('test-id-123', updateInput)).rejects.toThrow(
        'festival with ID test-id-123 not found'
      );
    });
  });

  describe('deleteFestival', () => {
    it('should delete festival successfully', async () => {
      const { FestivalEntity } = await import('./entity');
      vi.mocked(FestivalEntity.delete).mockReturnValue({
        go: vi.fn().mockResolvedValue({}),
      } as any);

      await expect(deleteFestival('test-id-123')).resolves.not.toThrow();

      expect(FestivalEntity.delete).toHaveBeenCalledWith({ id: 'test-id-123' });
    });
  });

  describe('listFestivals', () => {
    it('should return paginated approved festivals', async () => {
      const mockFestivals = [
        {
          id: 'fest-1',
          name: 'Festival 1',
          startDate: '2026-02-19',
          endDate: '2026-02-20',
          status: 'approved',
          createdBy: 'user-1',
          createdAt: '2025-01-09T00:00:00.000Z',
          updatedAt: '2025-01-09T00:00:00.000Z',
        },
      ];

      const { FestivalEntity } = await import('./entity');
      const mockGo = vi.fn().mockResolvedValue({
        data: mockFestivals,
        cursor: 'next-token-123',
      });
      vi.mocked(FestivalEntity.query.byStatus).mockReturnValue({
        go: mockGo,
      } as any);

      const result = await listFestivals({ limit: 10 });

      expect(FestivalEntity.query.byStatus).toHaveBeenCalledWith({ status: 'approved' });
      expect(result).toEqual({
        items: mockFestivals,
        nextToken: 'next-token-123',
        hasMore: true,
      });
    });

    it('should return empty result when no festivals found', async () => {
      const { FestivalEntity } = await import('./entity');
      const mockGo = vi.fn().mockResolvedValue({
        data: [],
        cursor: null,
      });
      vi.mocked(FestivalEntity.query.byStatus).mockReturnValue({
        go: mockGo,
      } as any);

      const result = await listFestivals();

      expect(result).toEqual({
        items: [],
        nextToken: undefined,
        hasMore: false,
      });
    });
  });
});
