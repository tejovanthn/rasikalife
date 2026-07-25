import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEventArtist,
  deleteEventArtist,
  getEventArtists,
  getEventsByArtist,
  setEventArtistFeatured,
} from '.';

vi.mock('./entity', () => ({
  EventArtistEntity: {
    create: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    query: {
      primary: vi.fn(),
      byArtist: vi.fn(),
    },
  },
}));

vi.mock('../artist/entity', () => ({
  ArtistEntity: {
    get: vi.fn(),
    update: vi.fn(),
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

describe('setEventArtistFeatured', () => {
  const patchedRow = {
    eventId: 'event-1',
    artistId: 'artist-1',
    eventTitle: 'Margazhi Recital',
    eventStartDateTime: '2026-01-30T17:30:00.000Z',
    role: 'vocal',
  };

  async function mocks(existingFeatured: unknown[] = []) {
    const { EventArtistEntity } = await import('./entity');
    const { ArtistEntity } = await import('../artist/entity');
    const patchSet = vi
      .fn()
      .mockReturnValue({ go: vi.fn().mockResolvedValue({ data: patchedRow }) });
    vi.mocked(EventArtistEntity.patch).mockReturnValue({ set: patchSet } as never);
    vi.mocked(ArtistEntity.get).mockReturnValue({
      go: vi
        .fn()
        .mockResolvedValue({ data: { id: 'artist-1', featuredPerformances: existingFeatured } }),
    } as never);
    const updateSet = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({}) });
    vi.mocked(ArtistEntity.update).mockReturnValue({ set: updateSet } as never);
    return { patchSet, updateSet, EventArtistEntity };
  }

  it('sets the flag and rank on the artist-event junction row', async () => {
    const { patchSet, EventArtistEntity } = await mocks();

    await setEventArtistFeatured('event-1', 'artist-1', true, 2);

    expect(EventArtistEntity.patch).toHaveBeenCalledWith({
      eventId: 'event-1',
      artistId: 'artist-1',
    });
    expect(patchSet).toHaveBeenCalledWith({ isFeatured: true, featureRank: 2 });
  });

  it('clears the rank when unfeaturing', async () => {
    const { patchSet } = await mocks();

    await setEventArtistFeatured('event-1', 'artist-1', false, 2);

    // A rank left behind on an unfeatured row would silently reorder the
    // teaser if the row were ever featured again.
    expect(patchSet).toHaveBeenCalledWith({ isFeatured: false, featureRank: undefined });
  });

  it('adds the performance to the artist featured list, sorted by rank', async () => {
    const { updateSet } = await mocks([
      {
        eventId: 'event-0',
        eventTitle: 'Older',
        eventStartDateTime: '2025-01-01T00:00:00.000Z',
        featureRank: 5,
      },
    ]);

    await setEventArtistFeatured('event-1', 'artist-1', true, 2);

    // Rank 2 sorts ahead of the existing rank-5 entry.
    expect(updateSet).toHaveBeenCalledWith({
      featuredPerformances: [
        {
          eventId: 'event-1',
          eventTitle: 'Margazhi Recital',
          eventStartDateTime: '2026-01-30T17:30:00.000Z',
          role: 'vocal',
          featureRank: 2,
        },
        {
          eventId: 'event-0',
          eventTitle: 'Older',
          eventStartDateTime: '2025-01-01T00:00:00.000Z',
          featureRank: 5,
        },
      ],
    });
  });

  it('removes the performance from the artist featured list when unfeaturing', async () => {
    const { updateSet } = await mocks([
      {
        eventId: 'event-1',
        eventTitle: 'Margazhi Recital',
        eventStartDateTime: '2026-01-30T17:30:00.000Z',
        role: 'vocal',
        featureRank: 2,
      },
      {
        eventId: 'event-2',
        eventTitle: 'Other',
        eventStartDateTime: '2025-06-01T00:00:00.000Z',
        featureRank: 3,
      },
    ]);

    await setEventArtistFeatured('event-1', 'artist-1', false);

    expect(updateSet).toHaveBeenCalledWith({
      featuredPerformances: [
        {
          eventId: 'event-2',
          eventTitle: 'Other',
          eventStartDateTime: '2025-06-01T00:00:00.000Z',
          featureRank: 3,
        },
      ],
    });
  });

  it('re-featuring replaces the existing entry rather than duplicating it', async () => {
    const { updateSet } = await mocks([
      {
        eventId: 'event-1',
        eventTitle: 'Stale title',
        eventStartDateTime: '2026-01-30T17:30:00.000Z',
        role: 'vocal',
        featureRank: 9,
      },
    ]);

    await setEventArtistFeatured('event-1', 'artist-1', true, 1);

    // One entry, with the fresh title and rank off the just-patched row.
    expect(updateSet).toHaveBeenCalledWith({
      featuredPerformances: [
        {
          eventId: 'event-1',
          eventTitle: 'Margazhi Recital',
          eventStartDateTime: '2026-01-30T17:30:00.000Z',
          role: 'vocal',
          featureRank: 1,
        },
      ],
    });
  });
});
