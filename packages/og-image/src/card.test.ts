import { describe, expect, it } from 'vitest';
import {
  CARD_VERSION,
  PHOTO_PANEL_X,
  buildSvg,
  contentHash,
  escapeXml,
  estimateTextWidth,
  fitTitle,
} from './card';

describe('escapeXml', () => {
  it('escapes all five XML-significant characters', () => {
    expect(escapeXml(`<a href="x">O'Brien & Sons</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;O&#39;Brien &amp; Sons&lt;/a&gt;'
    );
  });

  it('leaves plain text untouched', () => {
    expect(escapeXml('Sanjay Subrahmanyan')).toBe('Sanjay Subrahmanyan');
  });
});

describe('estimateTextWidth', () => {
  // A character count is not a width — the ladder this replaced counted characters, so wide
  // names overflowed into the photo panel while narrow ones wasted the column.
  it('separates wide from narrow glyphs at the same length', () => {
    expect(estimateTextWidth('W'.repeat(10), 40)).toBeGreaterThan(
      estimateTextWidth('i'.repeat(10), 40) * 2
    );
  });

  it('scales linearly with font size', () => {
    expect(estimateTextWidth('Sanjay', 80)).toBeCloseTo(estimateTextWidth('Sanjay', 40) * 2, 5);
  });
});

describe('fitTitle', () => {
  // Every title must render inside its column. The old ladder let real names past: the
  // reviewer measured "Bombay Jayashri Ramnath" spilling 6px under the photograph.
  const REAL_NAMES = [
    'Bombay Jayashri Ramnath',
    'Sanjay Subrahmanyan Iyengar',
    'Mysore Brothers Nagaraj and Manjunath',
    'T. M. Krishna',
    'Ranjani and Gayatri',
  ];

  it('keeps every real artist name inside the text column when a photo is present', () => {
    for (const name of REAL_NAMES) {
      const { text, fontSize, budget } = fitTitle(name, true);
      expect(estimateTextWidth(text, fontSize)).toBeLessThanOrEqual(budget);
    }
  });

  it('keeps pathologically wide titles inside the column by truncating', () => {
    for (const title of ['W'.repeat(40), 'M'.repeat(80), 'A'.repeat(200)]) {
      const { text, fontSize, budget } = fitTitle(title, true);
      expect(estimateTextWidth(text, fontSize)).toBeLessThanOrEqual(budget);
      expect(text.endsWith('…')).toBe(true);
    }
  });

  it('leaves a title that fits untouched, with no ellipsis', () => {
    const { text } = fitTitle('T. M. Krishna', true);
    expect(text).toBe('T. M. Krishna');
  });

  it('gives the same title a smaller budget when a photo takes the right-hand panel', () => {
    expect(fitTitle('x', true).budget).toBeLessThan(fitTitle('x', false).budget);
  });

  it('never picks a size whose text would reach the photo panel', () => {
    const { budget } = fitTitle('x', true);
    expect(48 + budget).toBeLessThan(PHOTO_PANEL_X);
  });
});

describe('contentHash', () => {
  it('is deterministic for the same inputs', () => {
    expect(contentHash(['a', 'b', 'c'])).toBe(contentHash(['a', 'b', 'c']));
  });

  it('changes when the title, subtitle, or photo url changes', () => {
    const base = contentHash(['Sanjay Subrahmanyan', 'Indian Classical Music', undefined]);
    const renamed = contentHash(['Sanjay S.', 'Indian Classical Music', undefined]);
    const withPhoto = contentHash([
      'Sanjay Subrahmanyan',
      'Indian Classical Music',
      'https://cdn.example.com/photo.jpg',
    ]);
    expect(renamed).not.toBe(base);
    expect(withPhoto).not.toBe(base);
  });

  it('treats a missing field and an empty string the same, by design', () => {
    expect(contentHash(['a', undefined])).toBe(contentHash(['a', '']));
  });

  // Without a separator, ['ab','c'] and ['a','bc'] hash alike — so a rename that shifts a
  // character across the title/subtitle boundary would keep serving the old immutable card.
  it('does not confuse adjacent fields with a shifted boundary', () => {
    expect(contentHash(['ab', 'c'])).not.toBe(contentHash(['a', 'bc']));
  });

  // The card template is not an input to the render call, so it has to be hashed explicitly:
  // otherwise a redesign leaves every card rendered beforehand frozen for a year.
  it('changes when the card version changes', () => {
    expect(contentHash([CARD_VERSION, 'Name'])).not.toBe(contentHash(['v-next', 'Name']));
  });

  it('returns a short hex digest', () => {
    expect(contentHash(['x'])).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('buildSvg', () => {
  it('omits the photo element when no photo is given', () => {
    const svg = buildSvg('Sanjay Subrahmanyan', 'Indian Classical Music', 'Artist');
    expect(svg).not.toContain('<image');
  });

  it('omits the photo element when the photo is explicitly null', () => {
    const svg = buildSvg('Sanjay Subrahmanyan', 'Indian Classical Music', 'Artist', null);
    expect(svg).not.toContain('<image');
  });

  it('emits the photo element and embeds the data URI when a photo is given', () => {
    const dataUri = 'data:image/jpeg;base64,ZmFrZQ==';
    const svg = buildSvg('Sanjay Subrahmanyan', 'Indian Classical Music', 'Artist', dataUri);
    expect(svg).toContain('<image');
    expect(svg).toContain(dataUri);
  });

  it('escapes the title and subtitle', () => {
    const svg = buildSvg(`O'Brien & Sons`, 'A <b>bold</b> claim', 'Artist');
    expect(svg).toContain('O&#39;Brien &amp; Sons');
    expect(svg).toContain('A &lt;b&gt;bold&lt;/b&gt; claim');
  });

  it('produces well-formed, single-root SVG markup', () => {
    const svg = buildSvg('Name', 'Subtitle', 'Artist', 'data:image/jpeg;base64,ZmFrZQ==');
    expect(svg.trim().startsWith('<svg')).toBe(true);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });
});
