import { describe, expect, it } from 'vitest';
import { repertoireView } from './raga-repertoire';

describe('repertoireView', () => {
  it('returns an empty repertoire when the stats are null', () => {
    expect(repertoireView(null)).toEqual({ performanceCount: 0, topCompositions: [] });
  });

  it('keeps the count and the first five compositions', () => {
    const top = [1, 2, 3, 4, 5, 6, 7].map(n => ({ title: `c${n}` }));
    const view = repertoireView({ performanceCount: 12, topCompositions: top });
    expect(view.performanceCount).toBe(12);
    expect(view.topCompositions).toEqual(top.slice(0, 5));
  });
});
