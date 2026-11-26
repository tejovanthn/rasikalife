import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scriptLang } from './script-lang';

describe('scriptLang', () => {
  it('gives each Indic script its language code', () => {
    expect(scriptLang('tamil')).toBe('ta');
    expect(scriptLang('telugu')).toBe('te');
    expect(scriptLang('kannada')).toBe('kn');
    expect(scriptLang('devanagari')).toBe('sa');
  });

  it('gives Latin scripts no code, so they inherit the page language', () => {
    expect(scriptLang('roman')).toBeUndefined();
    expect(scriptLang('iast')).toBeUndefined();
  });
});

describe('body font stack', () => {
  const css = readFileSync(join(__dirname, '../globals.css'), 'utf8');
  const body = css.match(/body\s*\{[^}]*font-family:\s*([^;]+);/)?.[1] ?? '';

  // Noto Sans (Latin) has no Tamil, Telugu or Kannada glyphs. Each companion must be named in
  // the stack, or the browser never uses the font root.tsx downloads.
  it.each(['Devanagari', 'Tamil', 'Telugu', 'Kannada'])('names Noto Sans %s', script => {
    expect(body).toContain(`"Noto Sans ${script}"`);
  });

  it('keeps Latin Noto Sans first', () => {
    expect(body.trim().startsWith('"Noto Sans",')).toBe(true);
  });
});
