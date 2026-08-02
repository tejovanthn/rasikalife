import { describe, expect, it } from 'vitest';
import { isAllowedPrivateContentType, safeFileName } from './private-s3';

describe('safeFileName', () => {
  /**
   * A filename arrives from a browser and lands in an S3 key. `..` does not escape a bucket the
   * way it escapes a directory, but it does produce keys that no longer sit under the prefix the
   * caller believes they do, which quietly breaks any prefix-scoped policy or lifecycle rule
   * added later.
   */
  it('strips path segments and traversal', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('C:\\Users\\me\\shot.png')).toBe('shot.png');
    expect(safeFileName('..')).toBe('upload');
  });

  it('keeps an ordinary name intact', () => {
    expect(safeFileName('payment-screenshot.png')).toBe('payment-screenshot.png');
    expect(safeFileName('IMG_2024.HEIC')).toBe('IMG_2024.HEIC');
  });

  it('replaces anything that would need escaping in a key', () => {
    expect(safeFileName('my photo (1).png')).toBe('my-photo--1-.png');
    expect(safeFileName('screenshot?v=2&x=1.png')).toBe('screenshot-v-2-x-1.png');
  });

  it('never returns an empty name', () => {
    expect(safeFileName('')).toBe('upload');
    expect(safeFileName('///')).toBe('upload');
    expect(safeFileName('...')).toBe('upload');
  });

  it('bounds the length', () => {
    expect(safeFileName(`${'a'.repeat(300)}.png`)).toHaveLength(100);
  });
});

describe('isAllowedPrivateContentType', () => {
  it('takes the formats a phone produces', () => {
    expect(isAllowedPrivateContentType('image/jpeg')).toBe(true);
    expect(isAllowedPrivateContentType('image/heic')).toBe(true);
    expect(isAllowedPrivateContentType('IMAGE/PNG')).toBe(true);
    expect(isAllowedPrivateContentType('application/pdf')).toBe(true);
  });

  // The bucket is private, so this is not an XSS guard — it is a guard against the bucket
  // becoming general-purpose file storage that nothing ever audits.
  it('refuses anything else', () => {
    expect(isAllowedPrivateContentType('text/html')).toBe(false);
    expect(isAllowedPrivateContentType('image/svg+xml')).toBe(false);
    expect(isAllowedPrivateContentType('application/octet-stream')).toBe(false);
  });
});
