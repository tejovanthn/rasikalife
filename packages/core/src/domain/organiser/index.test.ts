import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrganiser, deleteOrganiser, getOrganiser, listOrganisers, updateOrganiser } from '.';
import type { CreateOrganiserInput } from '.';

vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'test-id-123'),
}));

vi.mock('./entity', () => ({
  OrganiserEntity: {
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      byName: vi.fn(),
      list: vi.fn(),
    },
  },
}));

describe('Organiser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrganiser', () => {
    it('should create organiser with generated ID', async () => {
      const input: CreateOrganiserInput = {
        name: 'BTM Cultural Academy',
      };

      const mockOrganiser = {
        id: 'test-id-123',
        ...input,
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { OrganiserEntity } = await import('./entity');
      vi.mocked(OrganiserEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockOrganiser }),
      } as any);

      const organiser = await createOrganiser(input);

      expect(OrganiserEntity.create).toHaveBeenCalledWith({
        id: 'test-id-123',
        ...input,
      });
      expect(organiser).toEqual(mockOrganiser);
    });

    it('should throw error when creation fails', async () => {
      const input: CreateOrganiserInput = { name: 'Test Organiser' };

      const { OrganiserEntity } = await import('./entity');
      vi.mocked(OrganiserEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      await expect(createOrganiser(input)).rejects.toThrow('Failed to create organiser');
    });
  });

  describe('getOrganiser', () => {
    it('should return organiser when found', async () => {
      const mockOrganiser = {
        id: 'test-id-123',
        name: 'BTM Cultural Academy',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { OrganiserEntity } = await import('./entity');
      vi.mocked(OrganiserEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockOrganiser }),
      } as any);

      const organiser = await getOrganiser('test-id-123');

      expect(OrganiserEntity.get).toHaveBeenCalledWith({ id: 'test-id-123' });
      expect(organiser).toEqual(mockOrganiser);
    });

    it('should return null when organiser not found', async () => {
      const { OrganiserEntity } = await import('./entity');
      vi.mocked(OrganiserEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      const organiser = await getOrganiser('non-existent-id');

      expect(organiser).toBeNull();
    });
  });

  describe('updateOrganiser', () => {
    it('should update organiser successfully', async () => {
      const updateInput = { name: 'Updated Organiser' };
      const mockUpdatedOrganiser = {
        id: 'test-id-123',
        name: 'Updated Organiser',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T01:00:00.000Z',
      };

      const { OrganiserEntity } = await import('./entity');
      vi.mocked(OrganiserEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: mockUpdatedOrganiser }),
        }),
      } as any);

      const organiser = await updateOrganiser('test-id-123', updateInput);

      expect(OrganiserEntity.update).toHaveBeenCalledWith({ id: 'test-id-123' });
      expect(organiser).toEqual(mockUpdatedOrganiser);
    });

    it('should throw error when update fails', async () => {
      const updateInput = { name: 'Updated Organiser' };

      const { OrganiserEntity } = await import('./entity');
      vi.mocked(OrganiserEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: null }),
        }),
      } as any);

      await expect(updateOrganiser('test-id-123', updateInput)).rejects.toThrow(
        'organiser with ID test-id-123 not found'
      );
    });
  });

  describe('deleteOrganiser', () => {
    it('should delete organiser successfully', async () => {
      const { OrganiserEntity } = await import('./entity');
      vi.mocked(OrganiserEntity.delete).mockReturnValue({
        go: vi.fn().mockResolvedValue({}),
      } as any);

      await expect(deleteOrganiser('test-id-123')).resolves.not.toThrow();

      expect(OrganiserEntity.delete).toHaveBeenCalledWith({ id: 'test-id-123' });
    });
  });

  describe('listOrganisers', () => {
    it('should return paginated organisers', async () => {
      const mockOrganisers = [
        {
          id: 'org-1',
          name: 'Organiser 1',
          createdAt: '2025-01-09T00:00:00.000Z',
          updatedAt: '2025-01-09T00:00:00.000Z',
        },
        {
          id: 'org-2',
          name: 'Organiser 2',
          createdAt: '2025-01-09T00:00:00.000Z',
          updatedAt: '2025-01-09T00:00:00.000Z',
        },
      ];

      const { OrganiserEntity } = await import('./entity');
      vi.mocked(OrganiserEntity.query.list).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        go: vi.fn().mockResolvedValue({
          data: mockOrganisers,
          cursor: 'next-token-123',
        }),
      } as any);

      const result = await listOrganisers({ limit: 10, nextToken: 'prev-token' });

      expect(result).toEqual({
        items: mockOrganisers,
        nextToken: 'next-token-123',
        hasMore: true,
      });
    });

    it('should return empty result when no organisers found', async () => {
      const { OrganiserEntity } = await import('./entity');
      vi.mocked(OrganiserEntity.query.list).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        go: vi.fn().mockResolvedValue({
          data: [],
          cursor: null,
        }),
      } as any);

      const result = await listOrganisers();

      expect(result).toEqual({
        items: [],
        nextToken: undefined,
        hasMore: false,
      });
    });
  });
});
