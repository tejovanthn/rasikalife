import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTala, getTala, getTalaByName, updateTala, deleteTala } from './index';
import type { CreateTalaInput, UpdateTalaInput } from './index';

vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'test-tala-id'),
}));

vi.mock('./entity', () => ({
  TalaEntity: {
    create: vi.fn(),
    get: vi.fn(),
    query: {
      byName: vi.fn(),
    },
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Tala', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTala', () => {
    it('should create tala with generated ID and timestamps', async () => {
      const input: CreateTalaInput = {
        name: 'Adi',
      };

      const mockTala = {
        id: 'test-tala-id',
        ...input,
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { TalaEntity } = await import('./entity');
      vi.mocked(TalaEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockTala }),
      } as any);

      const tala = await createTala(input);

      expect(TalaEntity.create).toHaveBeenCalledWith({
        id: 'test-tala-id',
        ...input,
      });
      expect(tala).toEqual(mockTala);
    });

    it('should throw error when creation fails', async () => {
      const input: CreateTalaInput = { name: 'Test Tala' };

      const { TalaEntity } = await import('./entity');
      vi.mocked(TalaEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      await expect(createTala(input)).rejects.toThrow('Failed to create tala');
    });
  });

  describe('getTala', () => {
    it('should return tala when found', async () => {
      const mockTala = {
        id: 'tala-123',
        name: 'Adi',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { TalaEntity } = await import('./entity');
      vi.mocked(TalaEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockTala }),
      } as any);

      const tala = await getTala('tala-123');

      expect(TalaEntity.get).toHaveBeenCalledWith({ id: 'tala-123' });
      expect(tala).toEqual(mockTala);
    });

    it('should return null when tala not found', async () => {
      const { TalaEntity } = await import('./entity');
      vi.mocked(TalaEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      const tala = await getTala('non-existent-id');

      expect(tala).toBeNull();
    });
  });

  describe('getTalaByName', () => {
    it('should return tala when found by name', async () => {
      const mockTala = {
        id: 'tala-123',
        name: 'Adi',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { TalaEntity } = await import('./entity');
      vi.mocked(TalaEntity.query.byName).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: [mockTala] }),
      } as any);

      const tala = await getTalaByName('Adi');

      expect(TalaEntity.query.byName).toHaveBeenCalledWith({ name: 'Adi' });
      expect(tala).toEqual(mockTala);
    });

    it('should return null when tala not found by name', async () => {
      const { TalaEntity } = await import('./entity');
      vi.mocked(TalaEntity.query.byName).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: [] }),
      } as any);

      const tala = await getTalaByName('NonExistentTala');

      expect(tala).toBeNull();
    });
  });

  describe('updateTala', () => {
    it('should update tala successfully', async () => {
      const updateInput: UpdateTalaInput = { name: 'Updated Tala' };
      const mockUpdatedTala = {
        id: 'tala-123',
        name: 'Updated Tala',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T01:00:00.000Z',
      };

      const { TalaEntity } = await import('./entity');
      vi.mocked(TalaEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: mockUpdatedTala }),
        }),
      } as any);

      const tala = await updateTala('tala-123', updateInput);

      expect(TalaEntity.update).toHaveBeenCalledWith({ id: 'tala-123' });
      expect(tala).toEqual(mockUpdatedTala);
    });

    it('should throw error when update fails', async () => {
      const updateInput: UpdateTalaInput = { name: 'Updated Tala' };

      const { TalaEntity } = await import('./entity');
      vi.mocked(TalaEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: null }),
        }),
      } as any);

      await expect(updateTala('tala-123', updateInput)).rejects.toThrow('Tala tala-123 not found');
    });
  });

  describe('deleteTala', () => {
    it('should delete tala successfully', async () => {
      const { TalaEntity } = await import('./entity');
      vi.mocked(TalaEntity.delete).mockReturnValue({
        go: vi.fn().mockResolvedValue({}),
      } as any);

      await expect(deleteTala('tala-123')).resolves.not.toThrow();

      expect(TalaEntity.delete).toHaveBeenCalledWith({ id: 'tala-123' });
    });
  });
});
