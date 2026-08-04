import { describe, expect, it } from 'vitest';
import { ragaExactKey, ragaVariantKey } from './dedup';

describe('ragaExactKey', () => {
  it('ignores case', () => {
    expect(ragaExactKey('Todi')).toBe(ragaExactKey('todi'));
  });

  it('ignores diacritics, so the two Kalyani records collide', () => {
    expect(ragaExactKey('kalyāṇi')).toBe(ragaExactKey('kalyani'));
  });

  it('drops the alias bracket', () => {
    expect(ragaExactKey('kalyani (meca kalyani, shantakalyani)')).toBe('kalyani');
    expect(ragaExactKey('navaroj (navroj)')).toBe('navaroj');
  });

  it('ignores hyphens and spaces', () => {
    expect(ragaExactKey('hamir-kalyani')).toBe(ragaExactKey('hamir kalyani'));
  });

  it('keeps genuinely different ragas apart', () => {
    expect(ragaExactKey('ranjani')).not.toBe(ragaExactKey('rasikaranjani'));
    expect(ragaExactKey('abheri')).not.toBe(ragaExactKey('aabheri'));
  });

  it('handles empty string', () => {
    expect(ragaExactKey('')).toBe('');
  });
});

describe('ragaVariantKey', () => {
  it('collapses doubled vowels marking length', () => {
    expect(ragaVariantKey('aabheri')).toBe(ragaVariantKey('abheri'));
    expect(ragaVariantKey('bahudaari')).toBe(ragaVariantKey('bahudari'));
    expect(ragaVariantKey('behaag')).toBe(ragaVariantKey('behag'));
  });

  it('collapses c/k and sh/s spellings', () => {
    expect(ragaVariantKey('carukeshi')).toBe(ragaVariantKey('karukesi'));
    expect(ragaVariantKey('bhaageshri')).toBe(ragaVariantKey('bhageshri'));
  });

  it('collapses the -am and -a endings of one name', () => {
    expect(ragaVariantKey('margahindolam')).toBe(ragaVariantKey('margahindola'));
    expect(ragaVariantKey('hindolam')).toBe(ragaVariantKey('hindola'));
  });

  it('matches the hyphenation variants seen in the corpus', () => {
    expect(ragaVariantKey('hamirkalyani')).toBe(ragaVariantKey('hamir-kalyani'));
    expect(ragaVariantKey('amrita-behaag')).toBe(ragaVariantKey('amrita-behag'));
    expect(ragaVariantKey('ananda-bhairavi')).toBe(ragaVariantKey('anandabhairavi'));
  });

  it('still separates ragas that merely share a stem', () => {
    expect(ragaVariantKey('ranjani')).not.toBe(ragaVariantKey('rasikaranjani'));
    expect(ragaVariantKey('bhairavi')).not.toBe(ragaVariantKey('anandabhairavi'));
  });

  it('handles empty string', () => {
    expect(ragaVariantKey('')).toBe('');
  });
});
