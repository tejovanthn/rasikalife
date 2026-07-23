import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../event-artist', () => ({
  getEventsByArtist: vi.fn(),
  getEventArtists: vi.fn(),
}));

vi.mock('../event/entity', () => ({
  EventEntity: {
    get: vi.fn(),
  },
}));

vi.mock('./entity', () => ({
  ArtistEntity: {
    update: vi.fn(),
  },
}));

import { getEventArtists, getEventsByArtist } from '../event-artist';
import { EventEntity } from '../event/entity';
import { collaboratorStrength, rebuildArtistCollaborators } from './collaborators';
import { ArtistEntity } from './entity';

function page(items: unknown[], nextToken?: string) {
  return { items, nextToken, hasMore: !!nextToken };
}

function batchGetResult(events: Array<{ id: string; deletedAt?: string }>) {
  return { go: vi.fn().mockResolvedValue({ data: events, unprocessed: [] }) };
}

describe('collaboratorStrength', () => {
  const now = new Date('2026-07-22T00:00:00.000Z');

  it('scores a more recent shared event higher than an older one, same count', () => {
    const recent = collaboratorStrength(3, '2026-07-01T00:00:00.000Z', now);
    const old = collaboratorStrength(3, '2020-07-01T00:00:00.000Z', now);
    expect(recent).toBeGreaterThan(old);
  });

  it('scores a shared event today higher than one from years ago, same count', () => {
    const today = collaboratorStrength(1, now.toISOString(), now);
    const yearsAgo = collaboratorStrength(1, '2018-01-01T00:00:00.000Z', now);
    expect(today).toBeGreaterThan(yearsAgo);
  });

  it('lets count dominate when recency is equal', () => {
    const many = collaboratorStrength(10, '2026-01-01T00:00:00.000Z', now);
    const few = collaboratorStrength(2, '2026-01-01T00:00:00.000Z', now);
    expect(many).toBeGreaterThan(few);
  });

  it('does not produce a negative or absurd boost for a future date', () => {
    const future = collaboratorStrength(5, '2030-01-01T00:00:00.000Z', now);
    // Clamped to 0 months since last shared, so the boost caps at 2x count —
    // the same as a shared event happening today, never higher.
    expect(future).toBe(10);
    expect(future).toBe(collaboratorStrength(5, now.toISOString(), now));
  });

  it('falls back to no recency boost for an unparseable date', () => {
    const result = collaboratorStrength(4, 'not-a-date', now);
    expect(result).toBe(4);
    expect(Number.isNaN(result)).toBe(false);
  });

  it('defaults now to the current time when not provided', () => {
    const result = collaboratorStrength(2, new Date().toISOString());
    expect(Number.isNaN(result)).toBe(false);
    expect(result).toBeGreaterThan(0);
  });
});

describe('rebuildArtistCollaborators', () => {
  let updateSetMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    updateSetMock = vi.fn().mockReturnValue({ go: vi.fn().mockResolvedValue({ data: {} }) });
    vi.mocked(ArtistEntity.update).mockReturnValue({ set: updateSetMock } as any);
  });

  it('aggregates across two events sharing a co-artist, excludes self, takes the ' +
    'latest lastSharedAt, and dedupes topRoles', async () => {
    vi.mocked(getEventsByArtist).mockResolvedValueOnce(
      page([
        {
          eventId: 'event-1',
          artistId: 'artist-1',
          eventTitle: 'Concert 1',
          eventStartDateTime: '2026-01-01T10:00:00.000Z',
          artistName: 'Artist One',
        },
        {
          eventId: 'event-2',
          artistId: 'artist-1',
          eventTitle: 'Concert 2',
          eventStartDateTime: '2026-03-01T10:00:00.000Z',
          artistName: 'Artist One',
        },
      ])
    );
    vi.mocked(EventEntity.get).mockReturnValue(
      batchGetResult([{ id: 'event-1' }, { id: 'event-2' }]) as any
    );
    vi.mocked(getEventArtists).mockImplementation(async eventId => {
      if (eventId === 'event-1') {
        return page([
          {
            eventId: 'event-1',
            artistId: 'artist-1',
            artistName: 'Artist One',
            eventTitle: 'Concert 1',
            eventStartDateTime: '2026-01-01T10:00:00.000Z',
            role: 'mridangam',
          },
          {
            eventId: 'event-1',
            artistId: 'artist-2',
            artistName: 'Artist Two',
            eventTitle: 'Concert 1',
            eventStartDateTime: '2026-01-01T10:00:00.000Z',
            role: 'Vocal',
          },
          {
            eventId: 'event-1',
            artistId: 'artist-3',
            artistName: 'Artist Three',
            eventTitle: 'Concert 1',
            eventStartDateTime: '2026-01-01T10:00:00.000Z',
            role: 'Violin',
          },
        ]);
      }
      return page([
        {
          eventId: 'event-2',
          artistId: 'artist-1',
          artistName: 'Artist One',
          eventTitle: 'Concert 2',
          eventStartDateTime: '2026-03-01T10:00:00.000Z',
          role: 'mridangam',
        },
        {
          eventId: 'event-2',
          artistId: 'artist-2',
          artistName: 'Artist Two',
          eventTitle: 'Concert 2',
          eventStartDateTime: '2026-03-01T10:00:00.000Z',
          role: 'Vocalist',
        },
      ]);
    });

    await rebuildArtistCollaborators('artist-1');

    const expectedStrength2 = collaboratorStrength(2, '2026-03-01T10:00:00.000Z');
    const expectedStrength3 = collaboratorStrength(1, '2026-01-01T10:00:00.000Z');

    expect(ArtistEntity.update).toHaveBeenCalledWith({ id: 'artist-1' });
    expect(updateSetMock).toHaveBeenCalledWith({
      collaborators: [
        {
          artistId: 'artist-2',
          name: 'Artist Two',
          sharedEventCount: 2,
          lastSharedAt: '2026-03-01T10:00:00.000Z',
          topRoles: ['vocal'],
          strength: expectedStrength2,
        },
        {
          artistId: 'artist-3',
          name: 'Artist Three',
          sharedEventCount: 1,
          lastSharedAt: '2026-01-01T10:00:00.000Z',
          topRoles: ['violin'],
          strength: expectedStrength3,
        },
      ],
      collaboratorsComputedAt: '2025-01-15T12:00:00.000Z',
    });
  });

  it('excludes an event carrying deletedAt from the rebuild', async () => {
    vi.mocked(getEventsByArtist).mockResolvedValueOnce(
      page([
        {
          eventId: 'event-1',
          artistId: 'artist-1',
          eventTitle: 'Live Concert',
          eventStartDateTime: '2026-01-01T10:00:00.000Z',
          artistName: 'Artist One',
        },
        {
          eventId: 'event-2',
          artistId: 'artist-1',
          eventTitle: 'Deleted Concert',
          eventStartDateTime: '2026-02-01T10:00:00.000Z',
          artistName: 'Artist One',
        },
      ])
    );
    vi.mocked(EventEntity.get).mockReturnValue(
      batchGetResult([
        { id: 'event-1' },
        { id: 'event-2', deletedAt: '2026-06-01T00:00:00.000Z' },
      ]) as any
    );
    vi.mocked(getEventArtists).mockResolvedValueOnce(
      page([
        {
          eventId: 'event-1',
          artistId: 'artist-1',
          artistName: 'Artist One',
          eventTitle: 'Live Concert',
          eventStartDateTime: '2026-01-01T10:00:00.000Z',
        },
        {
          eventId: 'event-1',
          artistId: 'artist-2',
          artistName: 'Artist Two',
          eventTitle: 'Live Concert',
          eventStartDateTime: '2026-01-01T10:00:00.000Z',
          role: 'vocal',
        },
      ])
    );

    await rebuildArtistCollaborators('artist-1');

    // The soft-deleted event's cast is never even fetched.
    expect(getEventArtists).toHaveBeenCalledTimes(1);
    expect(getEventArtists).toHaveBeenCalledWith('event-1', { nextToken: undefined });

    expect(updateSetMock).toHaveBeenCalledWith({
      collaborators: [
        {
          artistId: 'artist-2',
          name: 'Artist Two',
          sharedEventCount: 1,
          lastSharedAt: '2026-01-01T10:00:00.000Z',
          topRoles: ['vocal'],
          strength: collaboratorStrength(1, '2026-01-01T10:00:00.000Z'),
        },
      ],
      collaboratorsComputedAt: '2025-01-15T12:00:00.000Z',
    });
  });

  it('writes an empty list, not skipping the write, when the artist has no events', async () => {
    vi.mocked(getEventsByArtist).mockResolvedValueOnce(page([]));

    await rebuildArtistCollaborators('artist-1');

    expect(EventEntity.get).not.toHaveBeenCalled();
    expect(getEventArtists).not.toHaveBeenCalled();
    expect(ArtistEntity.update).toHaveBeenCalledWith({ id: 'artist-1' });
    expect(updateSetMock).toHaveBeenCalledWith({
      collaborators: [],
      collaboratorsComputedAt: '2025-01-15T12:00:00.000Z',
    });
  });

  it('leaves topRoles undefined when the co-artist has no role recorded', async () => {
    vi.mocked(getEventsByArtist).mockResolvedValueOnce(
      page([
        {
          eventId: 'event-1',
          artistId: 'artist-1',
          eventTitle: 'Concert',
          eventStartDateTime: '2026-01-01T10:00:00.000Z',
          artistName: 'Artist One',
        },
      ])
    );
    vi.mocked(EventEntity.get).mockReturnValue(batchGetResult([{ id: 'event-1' }]) as any);
    vi.mocked(getEventArtists).mockResolvedValueOnce(
      page([
        {
          eventId: 'event-1',
          artistId: 'artist-2',
          artistName: 'Artist Two',
          eventTitle: 'Concert',
          eventStartDateTime: '2026-01-01T10:00:00.000Z',
        },
      ])
    );

    await rebuildArtistCollaborators('artist-1');

    const [{ collaborators }] = updateSetMock.mock.calls[0];
    expect(collaborators[0].topRoles).toBeUndefined();
  });

  it('pages through getEventsByArtist to gather every event before batching the deletedAt check', async () => {
    vi.mocked(getEventsByArtist)
      .mockResolvedValueOnce(
        page(
          [
            {
              eventId: 'event-1',
              artistId: 'artist-1',
              eventTitle: 'Concert 1',
              eventStartDateTime: '2026-01-01T10:00:00.000Z',
              artistName: 'Artist One',
            },
          ],
          'page-2'
        )
      )
      .mockResolvedValueOnce(
        page([
          {
            eventId: 'event-2',
            artistId: 'artist-1',
            eventTitle: 'Concert 2',
            eventStartDateTime: '2026-02-01T10:00:00.000Z',
            artistName: 'Artist One',
          },
        ])
      );
    vi.mocked(EventEntity.get).mockReturnValue(
      batchGetResult([{ id: 'event-1' }, { id: 'event-2' }]) as any
    );
    vi.mocked(getEventArtists).mockImplementation(async eventId =>
      page([
        {
          eventId,
          artistId: 'artist-2',
          artistName: 'Artist Two',
          eventTitle: 'Concert',
          eventStartDateTime:
            eventId === 'event-1' ? '2026-01-01T10:00:00.000Z' : '2026-02-01T10:00:00.000Z',
        },
      ])
    );

    await rebuildArtistCollaborators('artist-1');

    expect(getEventsByArtist).toHaveBeenCalledTimes(2);
    expect(getEventsByArtist).toHaveBeenNthCalledWith(1, 'artist-1', { nextToken: undefined });
    expect(getEventsByArtist).toHaveBeenNthCalledWith(2, 'artist-1', { nextToken: 'page-2' });
    expect(EventEntity.get).toHaveBeenCalledWith([{ id: 'event-1' }, { id: 'event-2' }]);

    const [{ collaborators }] = updateSetMock.mock.calls[0];
    expect(collaborators).toHaveLength(1);
    expect(collaborators[0].sharedEventCount).toBe(2);
  });

  it("pages through getEventArtists to gather an event's full cast", async () => {
    vi.mocked(getEventsByArtist).mockResolvedValueOnce(
      page([
        {
          eventId: 'event-1',
          artistId: 'artist-1',
          eventTitle: 'Concert',
          eventStartDateTime: '2026-01-01T10:00:00.000Z',
          artistName: 'Artist One',
        },
      ])
    );
    vi.mocked(EventEntity.get).mockReturnValue(batchGetResult([{ id: 'event-1' }]) as any);
    vi.mocked(getEventArtists)
      .mockResolvedValueOnce(
        page(
          [
            {
              eventId: 'event-1',
              artistId: 'artist-2',
              artistName: 'Artist Two',
              eventTitle: 'Concert',
              eventStartDateTime: '2026-01-01T10:00:00.000Z',
            },
          ],
          'cast-page-2'
        )
      )
      .mockResolvedValueOnce(
        page([
          {
            eventId: 'event-1',
            artistId: 'artist-3',
            artistName: 'Artist Three',
            eventTitle: 'Concert',
            eventStartDateTime: '2026-01-01T10:00:00.000Z',
          },
        ])
      );

    await rebuildArtistCollaborators('artist-1');

    expect(getEventArtists).toHaveBeenCalledTimes(2);
    expect(getEventArtists).toHaveBeenNthCalledWith(1, 'event-1', { nextToken: undefined });
    expect(getEventArtists).toHaveBeenNthCalledWith(2, 'event-1', { nextToken: 'cast-page-2' });

    const [{ collaborators }] = updateSetMock.mock.calls[0];
    const ids = collaborators.map((c: { artistId: string }) => c.artistId).sort();
    expect(ids).toEqual(['artist-2', 'artist-3']);
  });
});
