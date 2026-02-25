import { describe, expect, it } from 'vitest';
import { fromItrans, transliterate } from './transliteration';

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
});

describe('fromItrans', () => {
  it('converts to IAST by default', () => {
    expect(fromItrans('bhairavI')).toBe('bhairavī');
  });

  it('converts tyAgarAja to IAST', () => {
    expect(fromItrans('tyAgarAja')).toBe('tyāgarāja');
  });

  it('converts to Devanagari when specified', () => {
    expect(fromItrans('bhairavI', 'devanagari')).toBe('भैरवी');
  });

  it('handles empty string', () => {
    expect(fromItrans('')).toBe('');
  });
});
