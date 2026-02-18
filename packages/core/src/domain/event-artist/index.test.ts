import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventArtist, deleteEventArtist, getEventArtists, getEventsByArtist } from '.';

vi.mock('./entity', () => ({
  EventArtistEntity: {
    create: vi.fn(),
    delete: vi.fn(),
    query: {
      primary: vi.fn(),
      byArtist: vi.fn(),
    },
  },
}));

describe('EventArtist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createEventArtist', () => {
    it('should create event-artist junction record', async () => {
      const input = {
        eventId: 'event-1',
        artistId: 'artist-1',
        eventTitle: 'Concert',
        eventStartDateTime: '2026-01-30T17:30:00.000Z',
        artistName: 'Bhargavi Venkataram',
        artistTitle: 'Vid.',
        role: 'vocal',
      };

      const { EventArtistEntity } = await import('./entity');
      vi.mocked(EventArtistEntity.create).mockReturnValue({
        go: vi
          .fn()
          .mockResolvedValue({ data: { ...input, createdAt: '2025-01-09T00:00:00.000Z' } }),
      } as any);

      const result = await createEventArtist(input);

      expect(EventArtistEntity.create).toHaveBeenCalledWith(input);
      expect(result.eventId).toBe('event-1');
      expect(result.artistId).toBe('artist-1');
    });

    it('should throw error when creation fails', async () => {
      const input = {
        eventId: 'event-1',
        artistId: 'artist-1',
        eventTitle: 'Concert',
        eventStartDateTime: '2026-01-30T17:30:00.000Z',
        artistName: 'Test',
      };

      const { EventArtistEntity } = await import('./entity');
      vi.mocked(EventArtistEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      await expect(createEventArtist(input)).rejects.toThrow(
        'Failed to create event-artist relationship'
      );
    });
  });

  describe('getEventArtists', () => {
    it('should return artists for an event', async () => {
      const mockItems = [
        {
          eventId: 'event-1',
          artistId: 'artist-1',
          eventTitle: 'Concert',
          eventStartDateTime: '2026-01-30T17:30:00.000Z',
          artistName: 'Artist 1',
          role: 'vocal',
        },
      ];

      const { EventArtistEntity } = await import('./entity');
      vi.mocked(EventArtistEntity.query.primary).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockItems, cursor: null }),
      } as any);

      const result = await getEventArtists('event-1');

      expect(EventArtistEntity.query.primary).toHaveBeenCalledWith({ eventId: 'event-1' });
      expect(result.items).toEqual(mockItems);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('getEventsByArtist', () => {
    it('should return events for an artist (reverse lookup)', async () => {
      const mockItems = [
        {
          eventId: 'event-1',
          artistId: 'artist-1',
          eventTitle: 'Concert 1',
          eventStartDateTime: '2026-01-30T17:30:00.000Z',
          artistName: 'Bhargavi Venkataram',
        },
        {
          eventId: 'event-2',
          artistId: 'artist-1',
          eventTitle: 'Concert 2',
          eventStartDateTime: '2026-02-15T18:00:00.000Z',
          artistName: 'Bhargavi Venkataram',
        },
      ];

      const { EventArtistEntity } = await import('./entity');
      vi.mocked(EventArtistEntity.query.byArtist).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockItems, cursor: 'next-token' }),
      } as any);

      const result = await getEventsByArtist('artist-1', { limit: 10 });

      expect(EventArtistEntity.query.byArtist).toHaveBeenCalledWith({ artistId: 'artist-1' });
      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextToken).toBe('next-token');
    });
  });

  describe('deleteEventArtist', () => {
    it('should delete event-artist junction record', async () => {
      const { EventArtistEntity } = await import('./entity');
      vi.mocked(EventArtistEntity.delete).mockReturnValue({
        go: vi.fn().mockResolvedValue({}),
      } as any);

      await expect(deleteEventArtist('event-1', 'artist-1')).resolves.not.toThrow();

      expect(EventArtistEntity.delete).toHaveBeenCalledWith({
        eventId: 'event-1',
        artistId: 'artist-1',
      });
    });
  });
});
