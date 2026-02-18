import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVenue, deleteVenue, getVenue, listVenues, updateVenue } from '.';
import type { CreateVenueInput } from '.';

vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'test-id-123'),
}));

vi.mock('./entity', () => ({
  VenueEntity: {
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

describe('Venue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createVenue', () => {
    it('should create venue with generated ID', async () => {
      const input: CreateVenueInput = {
        name: 'Seva Sadan',
        address: {
          city: 'Bengaluru',
          state: 'Karnataka',
        },
      };

      const mockVenue = {
        id: 'test-id-123',
        ...input,
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { VenueEntity } = await import('./entity');
      vi.mocked(VenueEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockVenue }),
      } as any);

      const venue = await createVenue(input);

      expect(VenueEntity.create).toHaveBeenCalledWith({
        id: 'test-id-123',
        ...input,
      });
      expect(venue).toEqual(mockVenue);
    });

    it('should throw error when creation fails', async () => {
      const input: CreateVenueInput = { name: 'Test Venue' };

      const { VenueEntity } = await import('./entity');
      vi.mocked(VenueEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      await expect(createVenue(input)).rejects.toThrow('Failed to create venue');
    });
  });

  describe('getVenue', () => {
    it('should return venue when found', async () => {
      const mockVenue = {
        id: 'test-id-123',
        name: 'Seva Sadan',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { VenueEntity } = await import('./entity');
      vi.mocked(VenueEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockVenue }),
      } as any);

      const venue = await getVenue('test-id-123');

      expect(VenueEntity.get).toHaveBeenCalledWith({ id: 'test-id-123' });
      expect(venue).toEqual(mockVenue);
    });

    it('should return null when venue not found', async () => {
      const { VenueEntity } = await import('./entity');
      vi.mocked(VenueEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      const venue = await getVenue('non-existent-id');

      expect(venue).toBeNull();
    });
  });

  describe('updateVenue', () => {
    it('should update venue successfully', async () => {
      const updateInput = { name: 'Updated Venue' };
      const mockUpdatedVenue = {
        id: 'test-id-123',
        name: 'Updated Venue',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T01:00:00.000Z',
      };

      const { VenueEntity } = await import('./entity');
      vi.mocked(VenueEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: mockUpdatedVenue }),
        }),
      } as any);

      const venue = await updateVenue('test-id-123', updateInput);

      expect(VenueEntity.update).toHaveBeenCalledWith({ id: 'test-id-123' });
      expect(venue).toEqual(mockUpdatedVenue);
    });

    it('should throw error when update fails', async () => {
      const updateInput = { name: 'Updated Venue' };

      const { VenueEntity } = await import('./entity');
      vi.mocked(VenueEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: null }),
        }),
      } as any);

      await expect(updateVenue('test-id-123', updateInput)).rejects.toThrow(
        'venue with ID test-id-123 not found'
      );
    });
  });

  describe('deleteVenue', () => {
    it('should delete venue successfully', async () => {
      const { VenueEntity } = await import('./entity');
      vi.mocked(VenueEntity.delete).mockReturnValue({
        go: vi.fn().mockResolvedValue({}),
      } as any);

      await expect(deleteVenue('test-id-123')).resolves.not.toThrow();

      expect(VenueEntity.delete).toHaveBeenCalledWith({ id: 'test-id-123' });
    });
  });

  describe('listVenues', () => {
    it('should return paginated venues', async () => {
      const mockVenues = [
        {
          id: 'venue-1',
          name: 'Venue 1',
          createdAt: '2025-01-09T00:00:00.000Z',
          updatedAt: '2025-01-09T00:00:00.000Z',
        },
        {
          id: 'venue-2',
          name: 'Venue 2',
          createdAt: '2025-01-09T00:00:00.000Z',
          updatedAt: '2025-01-09T00:00:00.000Z',
        },
      ];

      const { VenueEntity } = await import('./entity');
      vi.mocked(VenueEntity.query.list).mockReturnValue({
        go: vi.fn().mockResolvedValue({
          data: mockVenues,
          cursor: 'next-token-123',
        }),
      } as any);

      const result = await listVenues({ limit: 10, nextToken: 'prev-token' });

      expect(result).toEqual({
        items: mockVenues,
        nextToken: 'next-token-123',
        hasMore: true,
      });
    });

    it('should return empty result when no venues found', async () => {
      const { VenueEntity } = await import('./entity');
      vi.mocked(VenueEntity.query.list).mockReturnValue({
        go: vi.fn().mockResolvedValue({
          data: [],
          cursor: null,
        }),
      } as any);

      const result = await listVenues();

      expect(result).toEqual({
        items: [],
        nextToken: undefined,
        hasMore: false,
      });
    });
  });
});
