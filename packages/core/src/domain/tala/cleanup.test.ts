import { describe, expect, it } from 'vitest';
import {
  formatTalaCleanupDecision,
  parseTalaCleanupDecision,
  suggestTalaCleanup,
  talaIdsAfter,
  talaKey,
} from './cleanup';

const CANONICAL = ['Adi', 'rUpaka', 'cApu', 'jhampa', 'cempat', 'dhruva'];
const RAGAS = new Set(['kAnaDA', 'bhairavi', 'kalyANi', 'tODi'].map(talaKey));

describe('suggestTalaCleanup', () => {
  it('keeps a canonical tala as it is', () => {
    expect(suggestTalaCleanup('Adi', CANONICAL, RAGAS)).toEqual({ kind: 'keep' });
  });

  it('merges a second spelling into the canonical one', () => {
    expect(suggestTalaCleanup('roopakam', CANONICAL, RAGAS)).toEqual({
      kind: 'merge',
      into: 'rUpaka',
    });
    expect(suggestTalaCleanup('/jhampa', CANONICAL, RAGAS)).toEqual({
      kind: 'merge',
      into: 'jhampa',
    });
  });

  it('unlinks a raga name that landed in the tala column', () => {
    expect(suggestTalaCleanup('kAnaDA.', CANONICAL, RAGAS)).toEqual({ kind: 'unlink' });
    expect(suggestTalaCleanup('Bhairavi.', CANONICAL, RAGAS)).toEqual({ kind: 'unlink' });
  });

  it('unlinks the fragments of "no given tALA"', () => {
    for (const name of ['m', 'or', 'given', 'none', '.']) {
      expect(suggestTalaCleanup(name, CANONICAL, RAGAS)).toEqual({ kind: 'unlink' });
    }
  });

  it('splits two talas offered as alternatives', () => {
    expect(suggestTalaCleanup('Adi/rUpaka', CANONICAL, RAGAS)).toEqual({
      kind: 'split',
      into: ['Adi', 'rUpaka'],
    });
    expect(suggestTalaCleanup('caapu or aadi', CANONICAL, RAGAS)).toEqual({
      kind: 'split',
      into: ['cApu', 'Adi'],
    });
  });

  it('leaves an unknown name for a person rather than guessing', () => {
    expect(suggestTalaCleanup('aTanta', CANONICAL, RAGAS)).toBeUndefined();
    expect(suggestTalaCleanup('khaNDa caapu', CANONICAL, RAGAS)).toBeUndefined();
  });
});

describe('parseTalaCleanupDecision', () => {
  it('round-trips every kind', () => {
    for (const text of ['keep', 'unlink', 'merge:Adi', 'split:Adi|rUpaka']) {
      const parsed = parseTalaCleanupDecision(text);
      expect(parsed).toBeDefined();
      if (parsed) expect(formatTalaCleanupDecision(parsed)).toBe(text);
    }
  });

  it('refuses a blank, an unknown word and a split with one tala', () => {
    expect(parseTalaCleanupDecision('')).toBeUndefined();
    expect(parseTalaCleanupDecision('delete')).toBeUndefined();
    expect(parseTalaCleanupDecision('merge:')).toBeUndefined();
    expect(parseTalaCleanupDecision('split:Adi')).toBeUndefined();
  });
});

describe('talaIdsAfter', () => {
  it('replaces the loser in place and keeps the other talas', () => {
    expect(talaIdsAfter(['a', 'x', 'b'], 'x', ['c'])).toEqual(['a', 'c', 'b']);
  });

  it('removes the loser when nothing replaces it', () => {
    expect(talaIdsAfter(['x', 'b'], 'x', [])).toEqual(['b']);
  });

  it('never lists a tala twice', () => {
    expect(talaIdsAfter(['a', 'x'], 'x', ['a', 'b'])).toEqual(['a', 'b']);
  });
});
