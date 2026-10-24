import { describe, expect, it } from 'vitest';
import { SHORT_CODE, isShortLinkTarget, shortLinkCode } from './code';

describe('shortLinkCode', () => {
  it('is seven lowercase base36 characters, and the same for the same target', () => {
    const code = shortLinkCode(
      '/events/ashtanayika-3L7jpdTnD2Grxr4HS8ycF7wCgsz?utm_source=whatsapp'
    );
    expect(code).toMatch(/^[0-9a-z]{7}$/);
    expect(SHORT_CODE.test(code)).toBe(true);
    expect(
      shortLinkCode('/events/ashtanayika-3L7jpdTnD2Grxr4HS8ycF7wCgsz?utm_source=whatsapp')
    ).toBe(code);
  });

  it('differs between targets, and a longer code extends the shorter one', () => {
    expect(shortLinkCode('/events/a')).not.toBe(shortLinkCode('/events/b'));
    expect(shortLinkCode('/events/a', 8).startsWith(shortLinkCode('/events/a'))).toBe(true);
  });
});

describe('isShortLinkTarget', () => {
  it('accepts site paths with UTM tags and listing filters', () => {
    expect(
      isShortLinkTarget(
        '/events/ashtanayika-3L7jpdTnD2Grxr4HS8ycF7wCgsz?utm_source=whatsapp&utm_medium=social&utm_campaign=listing_share&utm_content=event'
      )
    ).toBe(true);
    expect(isShortLinkTarget('/bengaluru/concerts?when=weekend&free=1&utm_content=listing')).toBe(
      true
    );
    expect(isShortLinkTarget('/events/this-weekend')).toBe(true);
  });

  it('refuses anything that could leave the site', () => {
    for (const target of [
      'https://evil.example/',
      '//evil.example/x',
      '/\\evil.example',
      'events',
      '/events/x#frag',
    ]) {
      expect(isShortLinkTarget(target), target).toBe(false);
    }
  });

  it('refuses unknown query keys, short links and very long targets', () => {
    expect(isShortLinkTarget('/events?next=https://evil.example')).toBe(false);
    expect(isShortLinkTarget('/l/abcdefg')).toBe(false);
    expect(isShortLinkTarget(`/events/${'a'.repeat(600)}`)).toBe(false);
  });
});
