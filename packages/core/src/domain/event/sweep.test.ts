import { describe, expect, it } from 'vitest';
import { chowdiahFestivals, chowdiahFirst, chowdiahSecond } from './__fixtures__/chowdiah-pair';
import { groupLikelyDuplicateEvents, groupSimilarFestivals } from './sweep';

describe('sweep', () => {
  it('groups the Chowdiah pair and keeps the live entry', () => {
    const other = { ...chowdiahFirst, id: 'x', venueId: 'elsewhere' };
    const pairs = groupLikelyDuplicateEvents([chowdiahFirst, chowdiahSecond, other]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].keeper.id).toBe(chowdiahFirst.id);
    expect(pairs[0].loser.id).toBe(chowdiahSecond.id);
  });
  it('reports nothing once the pair is acknowledged', () => {
    expect(
      groupLikelyDuplicateEvents([
        chowdiahFirst,
        { ...chowdiahSecond, notDuplicateOf: [chowdiahFirst.id] },
      ])
    ).toEqual([]);
  });
  it('groups the two festivals', () => {
    const pairs = groupSimilarFestivals(chowdiahFestivals);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].keeper.id).toBe(chowdiahFestivals[0].id);
  });
});
