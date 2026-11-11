import { describe, expect, it } from 'vitest';
import { isInAppBrowser } from './in-app-browser';

describe('isInAppBrowser', () => {
  it('detects Instagram and WhatsApp', () => {
    expect(
      isInAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0.0.0'
      )
    ).toBe(true);
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 13) WhatsApp/2.23.20')).toBe(true);
  });

  it('detects Facebook and Line', () => {
    expect(isInAppBrowser('Mozilla/5.0 [FBAN/FBIOS;FBAV/400.0]')).toBe(true);
    expect(isInAppBrowser('Mozilla/5.0 Safari Line/13.0.0')).toBe(true);
  });

  it('leaves real browsers alone', () => {
    expect(
      isInAppBrowser(
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'
      )
    ).toBe(false);
    expect(isInAppBrowser('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/17 Safari/604.1')).toBe(
      false
    );
    expect(isInAppBrowser(null)).toBe(false);
  });
});
