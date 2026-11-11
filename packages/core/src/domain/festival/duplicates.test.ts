import { describe, expect, it } from 'vitest';
import { chowdiahFestivals } from '../event/__fixtures__/chowdiah-pair';
import { findSimilarFestivals, suggestFestivalKeeper } from './duplicates';

describe('findSimilarFestivals', () => {
  const [long, short] = chowdiahFestivals;
  it('matches a name that grew between posters, on overlapping dates', () => {
    const found = findSimilarFestivals([long], { ...short, id: 'new' });
    expect(found.map(f => f.id)).toEqual([long.id]);
  });
  it('needs overlapping dates: next year is a new edition', () => {
    expect(
      findSimilarFestivals([long], {
        name: short.name,
        startDate: '2027-11-09',
        endDate: '2027-11-13',
      })
    ).toEqual([]);
  });
  it('does not match different festivals, or itself, or merged rows', () => {
    expect(
      findSimilarFestivals([long], {
        name: 'Ramanavami Sangeetha Utsava',
        startDate: '2026-11-09',
        endDate: '2026-11-13',
      })
    ).toEqual([]);
    expect(findSimilarFestivals([long], long)).toEqual([]);
    expect(findSimilarFestivals([{ ...long, mergedIntoId: 'x' }], { ...short, id: 'new' })).toEqual(
      []
    );
  });
  it('suggests the live festival with more events', () => {
    const a = { ...long, eventCount: 4 };
    const b = { ...short, eventCount: 9 };
    expect(suggestFestivalKeeper(a, b).keeper.id).toBe(a.id);
    expect(
      suggestFestivalKeeper({ ...a, status: 'submitted' }, { ...b, status: 'submitted' }).keeper.id
    ).toBe(b.id);
  });
});
