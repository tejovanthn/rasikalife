import { describe, expect, it } from 'vitest';
import { formatSwaras, fromItrans, transliterate } from './transliteration';

describe('transliterate', () => {
  it('converts ITRANS to IAST', () => {
    expect(transliterate('bhairavI', 'itrans', 'iast')).toBe('bhairavī');
  });

  it('converts ITRANS to Devanagari', () => {
    expect(transliterate('bhairavI', 'itrans', 'devanagari')).toBe('भैरवी');
  });

  it('is identity when from === to', () => {
    expect(transliterate('bhairavI', 'iast', 'iast')).toBe('bhairavI');
  });

  it('handles empty string', () => {
    expect(transliterate('', 'itrans', 'iast')).toBe('');
  });

  it('reads the Dravidian long vowels E and O', () => {
    // Plain `itrans` leaves these untouched, producing `husEni` on the page. IAST
    // has no long ē/ō of its own, so they land as plain `e`/`o` — the point is that
    // the capital is consumed as a vowel rather than surviving into the display name.
    expect(transliterate('husEni', 'itrans', 'iast')).toBe('huseni');
    expect(transliterate('vEgavAhini', 'itrans', 'iast')).toBe('vegavāhini');
  });
});

describe('fromItrans', () => {
  it('defaults to roman so anonymous visitors and crawlers get everyday spelling', () => {
    expect(fromItrans('bhairavI')).toBe('bhairavi');
    expect(fromItrans('kalyANi')).toBe('kalyani');
    expect(fromItrans('darbAri kAnaDa')).toBe('darbari kanada');
  });

  it('strips the mid-word capitals that made names look like broken data', () => {
    expect(fromItrans('husEni')).toBe('huseni');
    expect(fromItrans('vEgavAhini')).toBe('vegavahini');
  });

  it('still converts to IAST when asked', () => {
    expect(fromItrans('bhairavI', 'iast')).toBe('bhairavī');
    expect(fromItrans('tyAgarAja', 'iast')).toBe('tyāgarāja');
  });

  it('converts to Devanagari when specified', () => {
    expect(fromItrans('bhairavI', 'devanagari')).toBe('भैरवी');
  });

  it('handles empty string', () => {
    expect(fromItrans('')).toBe('');
  });
});

describe('formatSwaras', () => {
  it('leaves standard notation alone', () => {
    expect(formatSwaras('S R2 G2 M1 P D1 N2 S')).toBe('S R2 G2 M1 P D1 N2 S');
  });

  it('uppercases swara letters but keeps the variant digits', () => {
    expect(formatSwaras('s r2 g2 m1 p d1 n2 s')).toBe('S R2 G2 M1 P D1 N2 S');
  });

  it('collapses stray whitespace', () => {
    expect(formatSwaras('  S   R2  G3 M1 ')).toBe('S R2 G3 M1');
  });

  it('never transliterates — the letters collide with ITRANS consonants', () => {
    // `fromItrans` would turn this into `ṣ ṟ2 ġ2 ṃ1 P ḍ1 ṇ2 ṣ`.
    expect(formatSwaras('S R2 G2 M1 P D1 N2 S')).not.toMatch(/[̀-̣̱ͯ]/);
  });

  it('handles empty string', () => {
    expect(formatSwaras('')).toBe('');
  });
});
