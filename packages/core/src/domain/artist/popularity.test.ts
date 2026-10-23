import { describe, expect, it } from 'vitest';
import { artistPopularity } from './popularity';

describe('artistPopularity', () => {
  it('counts each event once per artist, weighted by RSVPs and attendance', () => {
    const scores = artistPopularity([
      { artists: [{ id: 'a' }, { id: 'b' }], rsvpCount: 3, attendedCount: 1 },
      // Two roles in one concert are one concert.
      { artists: [{ id: 'a' }, { id: 'a' }] },
      // Unlinked names and deleted events count nothing.
      { artists: [{ id: null }, { id: 'c' }], deletedAt: '2026-01-01' },
    ]);
    expect(Object.fromEntries(scores)).toEqual({ a: 6, b: 5 });
  });
});
