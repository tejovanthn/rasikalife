import { describe, expect, it } from 'vitest';
import { botTrafficConfig, isSuspectedBot } from './bot-fingerprint';

const bot = { screenWidth: 1280, screenHeight: 1200, timeZone: 'Asia/Singapore' };

describe('isSuspectedBot', () => {
  it('matches 1280x1200 in the Singapore timezone', () => {
    expect(isSuspectedBot(bot)).toBe(true);
  });

  it('needs both signals', () => {
    expect(isSuspectedBot({ ...bot, timeZone: 'Asia/Kolkata' })).toBe(false);
    expect(isSuspectedBot({ ...bot, screenHeight: 1080 })).toBe(false);
    expect(isSuspectedBot({ ...bot, screenWidth: 1920 })).toBe(false);
  });

  it('does not match a missing value', () => {
    expect(isSuspectedBot({})).toBe(false);
    expect(isSuspectedBot({ ...bot, timeZone: undefined })).toBe(false);
    expect(isSuspectedBot({ ...bot, timeZone: '' })).toBe(false);
  });
});

describe('botTrafficConfig', () => {
  it('tags a suspected bot', () => {
    expect(botTrafficConfig(true)).toEqual({ traffic_type: 'suspected_bot' });
  });

  it('leaves everyone else untouched', () => {
    expect(botTrafficConfig(false)).toBeUndefined();
  });

  it('is safe to call outside a browser', () => {
    expect(botTrafficConfig()).toBeUndefined();
  });
});
