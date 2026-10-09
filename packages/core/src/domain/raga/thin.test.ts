import { describe, expect, it } from 'vitest';
import { KEEP_INDEXED_RAGA_IDS, isThinRaga } from './thin';

describe('isThinRaga', () => {
  it('is thin when the record holds nothing but a name', () => {
    expect(isThinRaga({ compositionCount: 0 })).toBe(true);
  });

  it('stays thin with only a parent raga, since that is one line', () => {
    // The parent is not an input at all: it must not rescue the page.
    expect(isThinRaga({ arohanam: '', avarohanam: '  ', compositionCount: 0 })).toBe(true);
  });

  it('is not thin with a scale', () => {
    expect(isThinRaga({ arohanam: 'S R2 G3 P D2 S', compositionCount: 0 })).toBe(false);
    expect(isThinRaga({ avarohanam: 'S D2 P G3 R2 S', compositionCount: 0 })).toBe(false);
    expect(isThinRaga({ alternateScales: ['S R1 G3 M1 P D1 N3 S'], compositionCount: 0 })).toBe(
      false
    );
  });

  it('is not thin with a description, which is what the ranking thin pages have', () => {
    expect(
      isThinRaga({ description: 'Mishra Yaman is a mixed form of Yaman.', compositionCount: 0 })
    ).toBe(false);
    expect(isThinRaga({ description: '   ', compositionCount: 0 })).toBe(true);
  });

  it('is not thin with a composition or a logged performance', () => {
    expect(isThinRaga({ compositionCount: 1 })).toBe(false);
    expect(isThinRaga({ performanceCount: 2, compositionCount: 0 })).toBe(false);
  });

  it('never marks an allowlisted raga thin, however bare', () => {
    // rajalahari: no scale, no description, no composition, but 5 impressions.
    expect(isThinRaga({ id: '3A73KrTU0EgXIV0W20AGmQSDsZw', compositionCount: 0 })).toBe(false);
    expect(isThinRaga({ id: 'some-other-bare-raga', compositionCount: 0 })).toBe(true);
  });

  it('allowlists exactly the 20 thin pages that earned impressions', () => {
    expect(KEEP_INDEXED_RAGA_IDS.size).toBe(20);
  });
});
