import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveEvent,
  createEvent,
  deleteEvent,
  getEvent,
  listEventsByArtist,
  listEventsByFestival,
  listEventsByOrganiser,
  listEventsByVenue,
  listUpcomingEvents,
  updateEvent,
} from '.';
import type { CreateEventInput } from '.';

vi.mock('../../utils', () => ({
  generateId: vi.fn(() => 'test-id-123'),
}));

vi.mock('./entity', () => ({
  EventEntity: {
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      byStatus: vi.fn(),
      byFestival: vi.fn(),
      byVenue: vi.fn(),
      byOrganiser: vi.fn(),
    },
  },
}));

vi.mock('../event-artist/entity', () => ({
  EventArtistEntity: {
    create: vi.fn(),
    upsert: vi.fn(),
    query: {
      byArtist: vi.fn(),
    },
  },
}));

// approveEvent dynamically imports these for its side effects; stub them so the
// test exercises the approve/junction path without real collaborator I/O.
vi.mock('../artist/collaborators', () => ({
  rebuildArtistCollaborators: vi.fn().mockResolvedValue(undefined),
}));

describe('Event', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createEvent', () => {
    it('should create event with generated ID and userId', async () => {
      const input: CreateEventInput = {
        title: 'Concert by Vid. Bhargavi Venkataram',
        startDateTime: '2026-01-30T17:30:00.000Z',
        tags: ['carnatic', 'vocal', 'concert'],
        artists: [],
      };

      const mockEvent = {
        id: 'test-id-123',
        ...input,
        status: 'approved',
        createdBy: 'user-1',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { EventEntity } = await import('./entity');
      vi.mocked(EventEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockEvent }),
      } as any);

      const event = await createEvent(input, 'user-1');

      expect(EventEntity.create).toHaveBeenCalledWith({
        id: 'test-id-123',
        ...input,
        artForm: 'carnatic',
        status: 'approved',
        createdBy: 'user-1',
      });
      expect(event).toEqual(mockEvent);
    });

    it('should create EventArtist junction records for linked artists', async () => {
      const input: CreateEventInput = {
        title: 'Concert',
        startDateTime: '2026-01-30T17:30:00.000Z',
        artists: [
          { id: 'artist-1', name: 'Bhargavi Venkataram', title: 'Vid.', role: 'vocal' },
          { name: 'New Artist', role: 'violin' }, // No ID, not linked
        ],
      };

      const mockEvent = {
        id: 'test-id-123',
        ...input,
        status: 'approved',
        createdBy: 'user-1',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { EventEntity } = await import('./entity');
      vi.mocked(EventEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockEvent }),
      } as any);

      const { EventArtistEntity } = await import('../event-artist/entity');
      vi.mocked(EventArtistEntity.upsert).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: {} }),
      } as any);

      await createEvent(input, 'user-1');

      // Only linked artist (with id) should create junction record
      expect(EventArtistEntity.upsert).toHaveBeenCalledTimes(1);
      expect(EventArtistEntity.upsert).toHaveBeenCalledWith({
        eventId: 'test-id-123',
        artistId: 'artist-1',
        eventTitle: 'Concert',
        eventStartDateTime: '2026-01-30T17:30:00.000Z',
        artistName: 'Bhargavi Venkataram',
        artistTitle: 'Vid.',
        role: 'vocal',
      });
    });

    it('should throw error when creation fails', async () => {
      const input: CreateEventInput = {
        title: 'Test Event',
        startDateTime: '2026-01-30T17:30:00.000Z',
      };

      const { EventEntity } = await import('./entity');
      vi.mocked(EventEntity.create).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      await expect(createEvent(input, 'user-1')).rejects.toThrow('Failed to create event');
    });
  });

  describe('getEvent', () => {
    it('should return event when found', async () => {
      const mockEvent = {
        id: 'test-id-123',
        title: 'Concert',
        startDateTime: '2026-01-30T17:30:00.000Z',
        status: 'approved',
        createdBy: 'user-1',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
      };

      const { EventEntity } = await import('./entity');
      vi.mocked(EventEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: mockEvent }),
      } as any);

      const event = await getEvent('test-id-123');

      expect(EventEntity.get).toHaveBeenCalledWith({ id: 'test-id-123' });
      expect(event).toEqual(mockEvent);
    });

    it('should return null when event not found', async () => {
      const { EventEntity } = await import('./entity');
      vi.mocked(EventEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: null }),
      } as any);

      const event = await getEvent('non-existent-id');
      expect(event).toBeNull();
    });
  });

  describe('updateEvent', () => {
    it('should update event successfully', async () => {
      const updateInput = { title: 'Updated Concert' };
      const mockUpdatedEvent = {
        id: 'test-id-123',
        title: 'Updated Concert',
        startDateTime: '2026-01-30T17:30:00.000Z',
        status: 'approved',
        createdBy: 'user-1',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T01:00:00.000Z',
      };

      const { EventEntity } = await import('./entity');
      vi.mocked(EventEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: mockUpdatedEvent }),
        }),
      } as any);

      const event = await updateEvent('test-id-123', updateInput);

      expect(EventEntity.update).toHaveBeenCalledWith({ id: 'test-id-123' });
      expect(event).toEqual(mockUpdatedEvent);
    });

    it('should throw error when update fails', async () => {
      const { EventEntity } = await import('./entity');
      vi.mocked(EventEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: null }),
        }),
      } as any);

      await expect(updateEvent('test-id-123', { title: 'X' })).rejects.toThrow(
        'event with ID test-id-123 not found'
      );
    });
  });

  describe('deleteEvent', () => {
    it('should delete event successfully', async () => {
      const { EventEntity } = await import('./entity');
      vi.mocked(EventEntity.delete).mockReturnValue({
        go: vi.fn().mockResolvedValue({}),
      } as any);

      await expect(deleteEvent('test-id-123')).resolves.not.toThrow();
      expect(EventEntity.delete).toHaveBeenCalledWith({ id: 'test-id-123' });
    });
  });

  describe('listUpcomingEvents', () => {
    it('should return paginated upcoming approved events', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          title: 'Concert 1',
          startDateTime: '2026-02-15T17:30:00.000Z',
          status: 'approved',
          createdBy: 'user-1',
        },
      ];

      const { EventEntity } = await import('./entity');
      const mockGt = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        go: vi.fn().mockResolvedValue({
          data: mockEvents,
          cursor: 'next-token',
        }),
      });
      vi.mocked(EventEntity.query.byStatus).mockReturnValue({
        gt: mockGt,
      } as any);

      const result = await listUpcomingEvents({ limit: 10 });

      expect(EventEntity.query.byStatus).toHaveBeenCalledWith({ status: 'approved' });
      expect(result).toEqual({
        items: mockEvents,
        nextToken: 'next-token',
        hasMore: true,
      });
    });
  });

  describe('listEventsByFestival', () => {
    it('should return events for a festival', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'Day 1', festivalId: 'fest-1' },
        { id: 'event-2', title: 'Day 2', festivalId: 'fest-1' },
      ];

      const { EventEntity } = await import('./entity');
      vi.mocked(EventEntity.query.byFestival).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        go: vi.fn().mockResolvedValue({
          data: mockEvents,
          cursor: null,
        }),
      } as any);

      const result = await listEventsByFestival('fest-1');

      expect(EventEntity.query.byFestival).toHaveBeenCalledWith({ festivalId: 'fest-1' });
      expect(result).toEqual({
        items: mockEvents,
        nextToken: undefined,
        hasMore: false,
      });
    });
  });

  describe('listEventsByVenue', () => {
    it('should return events at a venue', async () => {
      const { EventEntity } = await import('./entity');
      vi.mocked(EventEntity.query.byVenue).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        go: vi.fn().mockResolvedValue({ data: [], cursor: null }),
      } as any);

      const result = await listEventsByVenue('venue-1');

      expect(EventEntity.query.byVenue).toHaveBeenCalledWith({ venueId: 'venue-1' });
      expect(result.items).toEqual([]);
    });
  });

  describe('listEventsByOrganiser', () => {
    it('should return events by an organiser', async () => {
      const { EventEntity } = await import('./entity');
      vi.mocked(EventEntity.query.byOrganiser).mockReturnValue({
        where: vi.fn().mockReturnThis(),
        go: vi.fn().mockResolvedValue({ data: [], cursor: null }),
      } as any);

      const result = await listEventsByOrganiser('org-1');

      expect(EventEntity.query.byOrganiser).toHaveBeenCalledWith({ organiserId: 'org-1' });
      expect(result.items).toEqual([]);
    });
  });

  describe('listEventsByArtist', () => {
    it('should return events for an artist via junction table', async () => {
      const mockEventArtists = [
        {
          eventId: 'event-1',
          artistId: 'artist-1',
          eventTitle: 'Concert 1',
          eventStartDateTime: '2026-01-30T17:30:00.000Z',
          artistName: 'Bhargavi Venkataram',
          artistTitle: 'Vid.',
          role: 'vocal',
        },
      ];

      const { EventArtistEntity } = await import('../event-artist/entity');
      vi.mocked(EventArtistEntity.query.byArtist).mockReturnValue({
        go: vi.fn().mockResolvedValue({
          data: mockEventArtists,
          cursor: null,
        }),
      } as any);

      const result = await listEventsByArtist('artist-1');

      expect(EventArtistEntity.query.byArtist).toHaveBeenCalledWith({ artistId: 'artist-1' });
      expect(result.items).toEqual(mockEventArtists);
    });

    // The GSI sorts ascending by date, so without a bound the profile teaser showed an
    // artist's oldest concerts and never their next one. These two guard the split.
    it('reads forward from now for upcoming events', async () => {
      const { EventArtistEntity } = await import('../event-artist/entity');
      const go = vi.fn().mockResolvedValue({ data: [], cursor: null });
      const gt = vi.fn().mockReturnValue({ go });
      const lt = vi.fn();
      vi.mocked(EventArtistEntity.query.byArtist).mockReturnValue({ gt, lt } as any);

      await listEventsByArtist('artist-1', { when: 'upcoming', limit: 4 });

      expect(gt).toHaveBeenCalledWith({ eventStartDateTime: expect.any(String) });
      expect(lt).not.toHaveBeenCalled();
      expect(go).toHaveBeenCalledWith(expect.objectContaining({ limit: 4 }));
      // Ascending, so the next concert comes first rather than the furthest-off one.
      expect(go.mock.calls[0][0]).not.toHaveProperty('order');
    });

    it('reads backward from now for past events', async () => {
      const { EventArtistEntity } = await import('../event-artist/entity');
      const go = vi.fn().mockResolvedValue({ data: [], cursor: null });
      const lt = vi.fn().mockReturnValue({ go });
      const gt = vi.fn();
      vi.mocked(EventArtistEntity.query.byArtist).mockReturnValue({ gt, lt } as any);

      await listEventsByArtist('artist-1', { when: 'past', limit: 6 });

      expect(lt).toHaveBeenCalledWith({ eventStartDateTime: expect.any(String) });
      expect(gt).not.toHaveBeenCalled();
      expect(go).toHaveBeenCalledWith(expect.objectContaining({ order: 'desc', limit: 6 }));
    });
  });

  describe('approveEvent', () => {
    // The add-a-performance flow relies on this: create as submitted, then
    // approve, and approval is what builds the EventArtist junction. If this
    // ever stops tagging the artist, that whole path silently produces
    // eventless artists.
    it('builds the EventArtist junction for a submitted single-artist event', async () => {
      const { EventEntity } = await import('./entity');
      const { EventArtistEntity } = await import('../event-artist/entity');

      const submitted = {
        id: 'event-1',
        status: 'submitted',
        title: 'Margazhi Recital',
        startDateTime: '2026-01-01T06:30:00.000Z',
        artists: [{ id: 'artist-1', name: 'T M Krishna', role: 'vocal' }],
      };
      vi.mocked(EventEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: submitted }),
      } as any);
      vi.mocked(EventEntity.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          go: vi.fn().mockResolvedValue({ data: { ...submitted, status: 'approved' } }),
        }),
      } as any);
      vi.mocked(EventArtistEntity.upsert).mockReturnValue({
        go: vi.fn().mockResolvedValue({}),
      } as any);

      await approveEvent('event-1', 'moderator-1');

      expect(EventArtistEntity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'event-1',
          artistId: 'artist-1',
          artistName: 'T M Krishna',
        })
      );
    });

    it('refuses to approve an event that is not submitted', async () => {
      const { EventEntity } = await import('./entity');
      vi.mocked(EventEntity.get).mockReturnValue({
        go: vi.fn().mockResolvedValue({ data: { id: 'event-1', status: 'draft' } }),
      } as any);

      await expect(approveEvent('event-1', 'moderator-1')).rejects.toThrow();
    });
  });
});
