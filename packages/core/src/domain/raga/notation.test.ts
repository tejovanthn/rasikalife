import { describe, expect, it } from 'vitest';
import {
  parseSwaraSet,
  resolveVariant,
  scalePositions,
  scaleTokens,
  swarasOutsideRaga,
  validatePhrase,
} from './notation';

describe('validatePhrase', () => {
  it("accepts SSP's Bhairavi phrase with octave dots and a karvai", () => {
    expect(validatePhrase('P G2:2 R2 S N2. R2 S N2. D1. P.')).toEqual({
      ok: true,
      value: 'P G2:2 R2 S N2. R2 S N2. D1. P.',
    });
  });

  it('needs no S and may start on any note', () => {
    expect(validatePhrase('r2 g2 m1 p d1 p').ok).toBe(true);
  });

  it('splits a pause written against a note into its own token', () => {
    expect(validatePhrase('P G2, R2 S;').value).toBe('P G2 , R2 S ;');
  });

  it('refuses prose and transliterated text', () => {
    expect(validatePhrase('rises from ri to dha').ok).toBe(false);
    expect(validatePhrase('ṣ ṟ2 ġ2').ok).toBe(false);
  });

  it('refuses a single note, which is not a phrase', () => {
    expect(validatePhrase('S').ok).toBe(false);
  });

  it('refuses M3, which is no swara', () => {
    expect(validatePhrase('S M3 P').reason).toContain('M3');
  });
});

describe('parseSwaraSet', () => {
  it('reads bare letters, as SSP names jiva swaras', () => {
    expect(parseSwaraSet('ri, ga, ma').ok).toBe(false);
    expect(parseSwaraSet('R G M N').tokens).toEqual(['R', 'G', 'M', 'N']);
  });

  it('drops octave marks and duplicates', () => {
    expect(parseSwaraSet(['N2.', 'N2', "S'"]).tokens).toEqual(['N2', 'S']);
  });
});

describe('resolveVariant', () => {
  const bhairavi = scaleTokens('S R2 G2 M1 P D2 N2 S N2 D1 P M1 G2 R2 S');

  it("takes the raga's own variant for a bare letter", () => {
    expect(resolveVariant('G', bhairavi)).toBe('G2');
  });

  it('leaves the letter bare when the raga uses two variants of it', () => {
    expect(resolveVariant('D', bhairavi)).toBe('D');
  });
});

describe('swarasOutsideRaga', () => {
  const scale = scaleTokens('S R2 G2 M1 P D1 N2 S');

  it('accepts a borrowed note named as anya', () => {
    expect(swarasOutsideRaga(['D2'], scale, ['D2'])).toEqual([]);
  });

  it('flags a note the raga does not use', () => {
    expect(swarasOutsideRaga(['G3', 'R'], scale)).toEqual(['G3']);
  });
});

describe('scalePositions', () => {
  it('marks D2 going up and D1 coming down for Bhairavi', () => {
    const p = scalePositions('S R2 G2 M1 P D2 N2 S', 'S N2 D1 P M1 G2 R2 S');
    expect(p.up).toEqual([0, 2, 3, 5, 7, 9, 10]);
    expect(p.down).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(p.names[9]).toBe('D2');
    expect(p.names[8]).toBe('D1');
  });
});
