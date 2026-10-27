import { describe, expect, it } from 'vitest';
import { type ScaleOf, describeChange, findRelatives, noteChanges } from './relatives';

const raga = (id: string, aro: string, ava: string, popularity = 0): ScaleOf => ({
  id,
  name: id,
  arohanam: aro,
  avarohanam: ava,
  popularity,
});

const kharaharapriya = raga('kharaharapriya', 'S R2 G2 M1 P D2 N2 S', 'S N2 D2 P M1 G2 R2 S');
const natabhairavi = raga('natabhairavi', 'S R2 G2 M1 P D1 N2 S', 'S N2 D1 P M1 G2 R2 S');
const bhairavi = raga('bhairavi', 'S R2 G2 M1 P D2 N2 S', 'S N2 D1 P M1 G2 R2 S');
const shankarabharanam = raga('shankarabharanam', 'S R2 G3 M1 P D2 N3 S', 'S N3 D2 P M1 G3 R2 S');

describe('noteChanges', () => {
  it('names a change made both ways once', () => {
    expect(noteChanges(kharaharapriya, natabhairavi)).toEqual([
      { from: 'D2', to: 'D1', direction: 'both' },
    ]);
  });

  it('names a change made one way only', () => {
    expect(noteChanges(natabhairavi, bhairavi)).toEqual([
      { from: 'D1', to: 'D2', direction: 'up' },
    ]);
  });

  it('treats R2 and G1 as the same pitch', () => {
    const a = raga('a', 'S R1 G1 M1 P D1 N1 S', 'S N1 D1 P M1 G1 R1 S');
    const b = raga('b', 'S R1 R2 M1 P D1 N1 S', 'S N1 D1 P M1 R2 R1 S');
    // b writes two R variants in one line, so it takes no part.
    expect(noteChanges(a, b)).toBeUndefined();
  });

  it('records a note one scale leaves out', () => {
    const mohanam = raga('mohanam', 'S R2 G3 P D2 S', 'S D2 P G3 R2 S');
    const out = noteChanges(shankarabharanam, mohanam);
    expect(out).toEqual([
      { from: 'M1', to: undefined, direction: 'both' },
      { from: 'N3', to: undefined, direction: 'both' },
    ]);
  });
});

describe('findRelatives', () => {
  it('orders by fewest changes, then popularity, and leaves itself out', () => {
    const corpus = [
      kharaharapriya,
      natabhairavi,
      bhairavi,
      shankarabharanam,
      raga('twin', 'S R2 G2 M1 P D2 N2 S', 'S N2 D1 P M1 G2 R2 S', 5),
    ];
    const found = findRelatives(bhairavi, corpus);
    expect(found.map(r => r.id)).toEqual(['twin', 'kharaharapriya', 'natabhairavi']);
    expect(found[0]?.changes).toEqual([]);
  });

  it('skips a raga with no stored scale', () => {
    expect(findRelatives(bhairavi, [{ id: 'bare', name: 'bare' }])).toEqual([]);
  });
});

describe('describeChange', () => {
  it('reads as a sentence fragment', () => {
    expect(describeChange({ from: 'D1', to: 'D2', direction: 'up' })).toBe(
      'uses D2 instead of D1 going up'
    );
    expect(describeChange({ from: 'M1', direction: 'both' })).toBe('leaves out M1');
  });
});
