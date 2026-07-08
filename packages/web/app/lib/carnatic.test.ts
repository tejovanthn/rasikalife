import { describe, expect, it } from 'vitest';
import { MELAKARTA_NAMES } from './carnatic';

describe('MELAKARTA_NAMES', () => {
  it('has all 72 melakarta ragas', () => {
    expect(Object.keys(MELAKARTA_NAMES)).toHaveLength(72);
  });

  it('is indexed from 1 to 72 with no gaps', () => {
    for (let mela = 1; mela <= 72; mela++) {
      expect(MELAKARTA_NAMES[mela]).toEqual(expect.any(String));
      expect(MELAKARTA_NAMES[mela].length).toBeGreaterThan(0);
    }
  });

  it('maps known reference points correctly', () => {
    expect(MELAKARTA_NAMES[1]).toBe('Kanakangi');
    expect(MELAKARTA_NAMES[29]).toBe('Dheerasankarabharanam');
    expect(MELAKARTA_NAMES[65]).toBe('Mechakalyani');
    expect(MELAKARTA_NAMES[72]).toBe('Rasikapriya');
  });

  it('has no entry outside the 1-72 range', () => {
    expect(MELAKARTA_NAMES[0]).toBeUndefined();
    expect(MELAKARTA_NAMES[73]).toBeUndefined();
  });
});
