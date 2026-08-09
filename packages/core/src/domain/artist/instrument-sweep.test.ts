import { describe, expect, it } from 'vitest';

import { instrumentFromRoles } from './enrich';
import { creditsByArtist } from './instrument-sweep';

const row = (
  over: Partial<{
    eventId: string;
    artistId: string;
    artistName: string;
    role: string;
    eventStartDateTime: string;
  }>
) => ({
  eventId: 'e1',
  artistId: 'a1',
  artistName: 'A',
  eventStartDateTime: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('creditsByArtist', () => {
  it('collects every credit an artist holds', () => {
    const result = creditsByArtist(
      [
        row({ eventId: 'e1', artistId: 'a1', role: 'vocal' }),
        row({ eventId: 'e2', artistId: 'a1', role: 'mridangam' }),
        row({ eventId: 'e2', artistId: 'a2', role: 'violin' }),
      ],
      new Set()
    );

    expect(result.get('a1')).toEqual(['vocal', 'mridangam']);
    expect(result.get('a2')).toEqual(['violin']);
  });

  it('drops credits from soft-deleted events', () => {
    const result = creditsByArtist(
      [
        row({ eventId: 'gone', artistId: 'a1', role: 'vocal' }),
        row({ eventId: 'live', artistId: 'a1', role: 'violin' }),
      ],
      new Set(['gone'])
    );

    expect(result.get('a1')).toEqual(['violin']);
  });

  it('leaves an artist out entirely when every event of theirs is deleted', () => {
    const result = creditsByArtist(
      [row({ eventId: 'gone', artistId: 'a1', role: 'vocal' })],
      new Set(['gone'])
    );

    expect(result.has('a1')).toBe(false);
  });

  it('keeps a missing role as a blank rather than dropping the appearance', () => {
    // The appearance still counts towards the reported total, and `instrumentFromRoles`
    // ignores the blank.
    const result = creditsByArtist(
      [
        row({ eventId: 'e1', artistId: 'a1' }),
        row({ eventId: 'e2', artistId: 'a1', role: 'veena' }),
      ],
      new Set()
    );

    expect(result.get('a1')).toEqual(['', 'veena']);
    expect(instrumentFromRoles(result.get('a1') as string[])).toBe('veena');
  });

  it('orders credits oldest first, so a tie breaks the same way on every run', () => {
    const rows = [
      row({ eventId: 'late', artistId: 'a1', role: 'ghatam', eventStartDateTime: '2026-06-01' }),
      row({ eventId: 'early', artistId: 'a1', role: 'vocal', eventStartDateTime: '2026-01-01' }),
    ];

    expect(creditsByArtist(rows, new Set()).get('a1')).toEqual(['vocal', 'ghatam']);
    // Same rows, opposite scan order — the sort is what makes the result stable, and an
    // unstable one would rewrite the stored string on every sweep.
    expect(creditsByArtist([...rows].reverse(), new Set()).get('a1')).toEqual(['vocal', 'ghatam']);
  });

  it('feeds instrumentFromRoles the repeats it ranks on', () => {
    const result = creditsByArtist(
      [
        row({ eventId: 'e1', artistId: 'a1', role: 'vocal' }),
        row({ eventId: 'e2', artistId: 'a1', role: 'mridangam' }),
        row({ eventId: 'e3', artistId: 'a1', role: 'mridangam' }),
      ],
      new Set()
    );

    expect(instrumentFromRoles(result.get('a1') as string[])).toBe('mridangam, vocal');
  });
});
