import { describe, expect, it } from 'vitest';
import { chowdiahFirst, chowdiahSecond } from './__fixtures__/chowdiah-pair';
import { eventMergeFillPatch, suggestEventKeeper } from './merge-fill';

describe('eventMergeFillPatch', () => {
  it('fills blanks only and never overwrites', () => {
    const patch = eventMergeFillPatch(
      { description: 'kept', posterUrl: '', tags: [], contactInfo: {} },
      { description: 'other', posterUrl: 'p.jpg', tags: ['flute'], contactInfo: { phone: '1' } }
    );
    expect(patch).toEqual({ posterUrl: 'p.jpg', tags: ['flute'], contactInfo: { phone: '1' } });
  });
  it('carries organiser and festival names with their ids, and never title or time', () => {
    const patch = eventMergeFillPatch(
      {},
      {
        organiserId: 'o',
        organiserName: 'Sabha',
        festivalId: 'f',
        festivalName: 'Fest',
        title: 'T',
      }
    );
    expect(patch).toEqual({
      organiserId: 'o',
      organiserName: 'Sabha',
      festivalId: 'f',
      festivalName: 'Fest',
    });
  });
  it('does not fill the venue pair or entryType', () => {
    expect(eventMergeFillPatch({}, { venueId: 'v', entryType: 'ticketed' })).toEqual({});
  });
});

describe('suggestEventKeeper', () => {
  it('keeps the live entry in the Chowdiah pair, and its blanks take the cast and poster', () => {
    const { keeper, loser } = suggestEventKeeper(chowdiahFirst, chowdiahSecond);
    expect(keeper.id).toBe(chowdiahFirst.id);
    expect(eventMergeFillPatch(keeper, loser)).toMatchObject({
      artists: chowdiahSecond.artists,
      posterUrl: chowdiahSecond.posterUrl,
    });
  });
  it('with both submitted, keeps the one with the cast', () => {
    const first = { ...chowdiahFirst, status: 'submitted' };
    expect(suggestEventKeeper(first, chowdiahSecond).keeper.id).toBe(chowdiahSecond.id);
  });
  it('prefers a live event, then cast, poster, then the older row', () => {
    const a = { id: 'a', status: 'approved', artists: [], createdAt: '2026-02-01' };
    const b = { id: 'b', status: 'submitted', artists: [{}, {}], createdAt: '2026-01-01' };
    expect(suggestEventKeeper(a, b).keeper.id).toBe('a');
    const c = { id: 'c', status: 'approved', artists: [], createdAt: '2026-01-01' };
    expect(suggestEventKeeper(a, c).keeper.id).toBe('c');
  });
});
