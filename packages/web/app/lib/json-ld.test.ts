import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from './json-ld';

describe('serializeJsonLd', () => {
  it('escapes a closing script tag so the element cannot be terminated early', () => {
    const out = serializeJsonLd({
      name: 'A',
      sameAs: ['https://x.com/</script><script>alert(1)</script>'],
    });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<');
    expect(out).toContain('\\u003c/script');
  });

  it('escapes a comment opener, which hides markup the same way', () => {
    expect(serializeJsonLd({ name: '<!--' })).not.toContain('<');
  });

  it('still parses back to the identical value, so crawlers read the same data', () => {
    const payload = {
      '@type': 'Person',
      name: 'T M Krishna',
      sameAs: ['https://example.com/a?b=1&c=2', 'https://x.com/</script>'],
      award: ['Sangita Kalanidhi'],
    };
    expect(JSON.parse(serializeJsonLd(payload))).toEqual(payload);
  });

  it('leaves ordinary payloads untouched', () => {
    expect(serializeJsonLd({ name: 'Bombay Jayashri' })).toBe('{"name":"Bombay Jayashri"}');
  });
});
