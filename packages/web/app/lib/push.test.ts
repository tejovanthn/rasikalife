import { describe, expect, it } from 'vitest';
import {
  PUSH_COPY,
  isIos,
  isIosNotInstalled,
  parseSubscriptionForm,
  pushUiState,
  toSubscriptionInput,
  urlBase64ToUint8Array,
} from './push';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
const MAC = IPAD_AS_MAC;
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

describe('iOS detection', () => {
  it('knows an iPhone', () => {
    expect(isIos(IPHONE)).toBe(true);
    expect(isIos(ANDROID)).toBe(false);
  });
  it('knows an iPad that reports a Mac, but not a real Mac', () => {
    expect(isIos(IPAD_AS_MAC, 5)).toBe(true);
    expect(isIos(MAC, 0)).toBe(false);
  });
  it('is "not installed" only until it runs from the Home Screen', () => {
    expect(isIosNotInstalled({ userAgent: IPHONE, standalone: false })).toBe(true);
    expect(isIosNotInstalled({ userAgent: IPHONE, standalone: true })).toBe(false);
    expect(isIosNotInstalled({ userAgent: ANDROID, standalone: false })).toBe(false);
  });
});

describe('pushUiState', () => {
  const base = {
    hasVapidKey: true,
    userAgent: ANDROID,
    standalone: false,
    hasServiceWorker: true,
    hasPushManager: true,
    hasNotification: true,
    permission: 'default' as const,
    subscribed: false,
  };

  it('shows the button by default', () => {
    expect(pushUiState(base)).toBe('available');
  });
  it('is unsupported without a key or without push', () => {
    expect(pushUiState({ ...base, hasVapidKey: false })).toBe('unsupported');
    expect(pushUiState({ ...base, hasPushManager: false })).toBe('unsupported');
    expect(pushUiState({ ...base, hasServiceWorker: false })).toBe('unsupported');
  });
  it('shows the Home Screen helper on iOS before install, even though push is missing', () => {
    expect(pushUiState({ ...base, userAgent: IPHONE, hasPushManager: false })).toBe('ios-install');
    expect(pushUiState({ ...base, userAgent: IPHONE, standalone: true })).toBe('available');
  });
  it('reports blocked and enabled', () => {
    expect(pushUiState({ ...base, permission: 'denied' })).toBe('blocked');
    expect(pushUiState({ ...base, permission: 'granted', subscribed: true })).toBe('enabled');
    // Permission granted but no subscription on this device: offer the button again.
    expect(pushUiState({ ...base, permission: 'granted' })).toBe('available');
  });
});

describe('copy', () => {
  it('uses the Copy strings', () => {
    expect(PUSH_COPY.button).toBe('Remind me the day before');
    expect(PUSH_COPY.enabled).toBe('Reminders are on for this device.');
    expect(PUSH_COPY.iosInstall).toContain('Add to Home Screen');
  });
});

describe('subscription helpers', () => {
  it('decodes URL-safe base64', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255]);
  });
  it('needs an endpoint and both keys', () => {
    expect(
      toSubscriptionInput({ endpoint: 'https://p/1', keys: { p256dh: 'a', auth: 'b' } })
    ).toEqual({ endpoint: 'https://p/1', keys: { p256dh: 'a', auth: 'b' } });
    expect(toSubscriptionInput({ endpoint: 'https://p/1', keys: { p256dh: 'a' } })).toBeNull();
    expect(toSubscriptionInput({})).toBeNull();
  });
  it('reads the posted form', () => {
    const f = new FormData();
    f.set('endpoint', 'https://p/1');
    f.set('p256dh', 'a');
    f.set('auth', 'b');
    expect(parseSubscriptionForm(f)?.keys).toEqual({ p256dh: 'a', auth: 'b' });
    f.set('auth', '');
    expect(parseSubscriptionForm(f)).toBeNull();
  });
});
