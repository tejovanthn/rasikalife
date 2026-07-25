import { describe, expect, it } from 'vitest';
import { buildRepertoireByArtist } from './repertoire-sweep';

describe('buildRepertoireByArtist', () => {
  it('aggregates each artist across their non-deleted events', () => {
    const eventArtistRows = [
      { eventId: 'e1', artistId: 'a1' },
      { eventId: 'e1', artistId: 'a2' },
      { eventId: 'e2', artistId: 'a1' }, // e2 is soft-deleted
      { eventId: 'e3', artistId: 'a2' }, // e3 has an empty setlist
    ];
    const setlistByEvent = new Map([
      [
        'e1',
        [
          {
            compositionId: 'c1',
            compositionTitle: 'Vatapi',
            ragaId: 'r1',
            ragaName: 'Hamsadhwani',
          },
        ],
      ],
      ['e2', [{ compositionId: 'c2', compositionTitle: 'Endaro', ragaId: 'r2', ragaName: 'Sri' }]],
      ['e3', []],
    ]);
    const deletedEventIds = new Set(['e2']);

    const result = buildRepertoireByArtist(eventArtistRows, setlistByEvent, deletedEventIds);

    // a1's only live event is e1 (e2 is deleted), so Endaro/Sri from e2 must not appear.
    expect(result.get('a1')).toEqual({
      topCompositions: [{ id: 'c1', title: 'Vatapi', count: 1 }],
      topRagas: [{ id: 'r1', name: 'Hamsadhwani', count: 1 }],
    });
    // a2 has e1 and e3; e3 is empty, so only e1 counts.
    expect(result.get('a2')?.topCompositions).toEqual([{ id: 'c1', title: 'Vatapi', count: 1 }]);
  });

  it('omits an artist whose every event is deleted or empty', () => {
    const result = buildRepertoireByArtist(
      [
        { eventId: 'e1', artistId: 'a1' },
        { eventId: 'e2', artistId: 'a1' },
      ],
      new Map([
        ['e1', [{ compositionId: 'c1', compositionTitle: 'Vatapi' }]],
        ['e2', []],
      ]),
      new Set(['e1'])
    );

    // e1 deleted, e2 empty → no rows → the artist is absent (the sweep clears them).
    expect(result.has('a1')).toBe(false);
  });
});
