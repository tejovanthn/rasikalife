import { describe, expect, it } from 'vitest';
import { janyaParentName, relativesView, topCompositionsView } from './raga-page-view';

const change = (from: string, to: string) => [{ direction: 'both', from, to }];

describe('relativesView', () => {
  it('leaves out the raga own parent', () => {
    const rows = [
      { id: 'parent', changes: change('G2', 'G3') },
      { id: 'other', changes: change('D2', 'D1') },
    ];
    expect(relativesView(rows, 'parent').map(r => r.id)).toEqual(['other']);
  });

  it('collapses records that differ by the same notes', () => {
    const rows = [
      { id: 'a', changes: change('R1', 'R2') },
      { id: 'b', changes: change('R1', 'R2') },
      { id: 'c', changes: change('G2', 'G3') },
    ];
    expect(relativesView(rows, undefined).map(r => r.id)).toEqual(['a', 'c']);
  });

  it('keeps every relative that has the same notes but moves differently', () => {
    const rows = [
      { id: 'a', changes: [] },
      { id: 'b', changes: [] },
    ];
    expect(relativesView(rows, undefined)).toHaveLength(2);
  });
});

describe('janyaParentName', () => {
  const names = { 16: 'Chakravakam' };
  it('uses the parent record, so the heading matches the Parent Raga row', () => {
    expect(janyaParentName({ name: 'Cakravaka' }, 16, names)).toBe('Cakravaka');
  });
  it('falls back to the fixed table with no parent record', () => {
    expect(janyaParentName(undefined, 16, names)).toBe('Chakravakam');
    expect(janyaParentName(null, 99, names)).toBeUndefined();
  });
});

describe('topCompositionsView', () => {
  it('shows a transliterated title and keeps the raw one for the link', () => {
    const [row] = topCompositionsView([{ id: '1', title: 'ArUrAn2 pADiya', count: 3 }], 'roman');
    expect(row.title).toBe('ArUrAn2 pADiya');
    expect(row.display).not.toContain('2');
    expect(row.display.length).toBeGreaterThan(0);
  });
});
