import { describe, expect, it } from 'vitest';
import { homeLocationLabel, resolveHomeLocation } from './home-location';

describe('resolveHomeLocation', () => {
  it('places a known PIN at its centroid', () => {
    const result = resolveHomeLocation({ pin: '560 003' });
    expect(result.ok && result.location).toMatchObject({ pin: '560003', source: 'pin' });
  });

  it('refuses a malformed or unknown PIN', () => {
    expect(resolveHomeLocation({ pin: '5600' })).toEqual({ ok: false, reason: 'invalid-pin' });
    expect(resolveHomeLocation({ pin: '411001' })).toEqual({ ok: false, reason: 'unknown-pin' });
  });

  it('rounds a device location to about a kilometre', () => {
    expect(resolveHomeLocation({ lat: 12.971598, lng: 77.594566 })).toEqual({
      ok: true,
      location: { lat: 12.97, lng: 77.59, source: 'device' },
    });
    expect(resolveHomeLocation({ lat: 91, lng: 0 })).toEqual({
      ok: false,
      reason: 'invalid-coordinates',
    });
  });
});

describe('homeLocationLabel', () => {
  it('names the PIN, or says "your location"', () => {
    expect(homeLocationLabel({ lat: 1, lng: 2, pin: '560004', source: 'pin' })).toBe('560004');
    expect(homeLocationLabel({ lat: 1, lng: 2, source: 'device' })).toBe('your location');
  });
});
