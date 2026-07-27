import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { buildSvg, contentHash, escapeXml, parsePath, titleFontSize } from './handler';

function eventWithPath(rawPath: string): APIGatewayProxyEventV2 {
  return { rawPath } as APIGatewayProxyEventV2;
}

describe('parsePath', () => {
  it('parses /og/{type}/{id}', () => {
    expect(parsePath(eventWithPath('/og/artist/abc123'))).toEqual({
      type: 'artist',
      id: 'abc123',
    });
  });

  it('parses /{type}/{id} without the og prefix', () => {
    expect(parsePath(eventWithPath('/raga/xyz'))).toEqual({ type: 'raga', id: 'xyz' });
  });

  it('rejects an unknown type but still surfaces the id', () => {
    expect(parsePath(eventWithPath('/og/venue/abc'))).toEqual({ type: null, id: 'abc' });
  });

  it('rejects a path missing an id', () => {
    expect(parsePath(eventWithPath('/og/artist'))).toEqual({ type: null, id: null });
  });

  it('rejects an empty path', () => {
    expect(parsePath(eventWithPath('/'))).toEqual({ type: null, id: null });
  });
});

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

describe('titleFontSize', () => {
  it('picks the largest size for a short title with no photo', () => {
    expect(titleFontSize('Short', false)).toBe(80);
  });

  it('steps down as the title grows, with no photo', () => {
    expect(titleFontSize('A'.repeat(25), false)).toBe(64);
    expect(titleFontSize('A'.repeat(45), false)).toBe(52);
    expect(titleFontSize('A'.repeat(60), false)).toBe(40);
  });

  it('uses a tighter ladder when a photo is present', () => {
    expect(titleFontSize('Short', true)).toBe(72);
    expect(titleFontSize('A'.repeat(20), true)).toBe(56);
    expect(titleFontSize('A'.repeat(30), true)).toBe(44);
    expect(titleFontSize('A'.repeat(60), true)).toBe(34);
  });

  it('shrinks sooner with a photo than without, for the same title', () => {
    const title = 'A'.repeat(30);
    expect(titleFontSize(title, true)).toBeLessThan(titleFontSize(title, false));
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
