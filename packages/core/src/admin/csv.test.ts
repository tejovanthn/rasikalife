import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv';

describe('toCsv', () => {
  it('joins rows with CRLF and a trailing newline', () => {
    expect(
      toCsv([
        ['a', 'b'],
        ['c', 'd'],
      ])
    ).toBe('a,b\r\nc,d\r\n');
  });

  it('returns an empty string for no rows', () => {
    expect(toCsv([])).toBe('');
  });

  it('quotes fields containing commas, quotes, or newlines', () => {
    expect(toCsv([['plain', 'has,comma', 'has"quote', 'has\nnewline']])).toBe(
      'plain,"has,comma","has""quote","has\nnewline"\r\n'
    );
  });
});

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('tolerates LF-only line endings', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('parses quoted fields with embedded commas, quotes, and newlines', () => {
    expect(parseCsv('"has,comma","has""quote","has\nnewline"\r\n')).toEqual([
      ['has,comma', 'has"quote', 'has\nnewline'],
    ]);
  });

  it('preserves trailing empty fields', () => {
    expect(parseCsv('a,')).toEqual([['a', '']]);
  });

  it('strips a leading BOM', () => {
    expect(parseCsv('﻿a,b')).toEqual([['a', 'b']]);
  });

  it('returns no rows for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('round-trips arbitrary content through toCsv', () => {
    const rows = [
      ['id', 'name', 'notes'],
      ['1', 'Music Academy', 'Line 1\nLine 2, with comma'],
      ['2', 'The "Grand" Hall', ''],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
