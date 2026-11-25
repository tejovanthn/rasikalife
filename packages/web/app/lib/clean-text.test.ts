import { describe, expect, it } from 'vitest';
import { cleaningFetch, stripControlChars, stripControlCharsFromJson } from './clean-text';

describe('stripControlChars', () => {
  it('removes NUL and other C0 controls, keeps tab, newline, return', () => {
    expect(stripControlChars('a\u0000b\u0007c\u001fd\te\nf\rg')).toBe('abcd\te\nf\rg');
  });
  it('keeps Unicode text', () => {
    expect(stripControlChars('kāpi राग 🎵')).toBe('kāpi राग 🎵');
  });
});

describe('stripControlCharsFromJson', () => {
  it('removes an escaped NUL and the result still parses', () => {
    const json = JSON.stringify({ a: 'Abh\u0000eri', b: 'x\u0001y' });
    expect(json).toContain('\\u0000');
    expect(JSON.parse(stripControlCharsFromJson(json))).toEqual({ a: 'Abheri', b: 'xy' });
  });
  it('keeps escaped tab, newline and quote', () => {
    const value = { a: 'x\ty\nz"q' };
    expect(JSON.parse(stripControlCharsFromJson(JSON.stringify(value)))).toEqual(value);
  });
  it('keeps the literal text "\\u0000" (an escaped backslash)', () => {
    const value = { a: 'write \\u0000 for NUL', b: 'two \\\\u0001' };
    expect(JSON.parse(stripControlCharsFromJson(JSON.stringify(value)))).toEqual(value);
  });
  it('handles a NUL at the start of a string and back to back', () => {
    const value = { a: '\u0000\u0000x' };
    expect(JSON.parse(stripControlCharsFromJson(JSON.stringify(value)))).toEqual({ a: 'x' });
  });
});

describe('cleaningFetch', () => {
  it('cleans a JSON response and leaves other types alone', async () => {
    const body = JSON.stringify([{ result: { data: { name: 'Ab\u0000heri' } } }]);
    const f = cleaningFetch(
      async () =>
        new Response(body, {
          headers: { 'content-type': 'application/json', 'content-length': '999' },
        })
    );
    const res = await f('http://x');
    expect(await res.json()).toEqual([{ result: { data: { name: 'Abheri' } } }]);
    const plain = await cleaningFetch(async () => new Response('a\u0000b'))('http://x');
    expect(await plain.text()).toBe('a\u0000b');
  });
});
