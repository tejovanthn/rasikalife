import { describe, expect, it } from 'vitest';
import { distanceKm, formatDistance } from './distance';

describe('distanceKm', () => {
  it('measures Malleswaram to Basavanagudi at about 6 km', () => {
    const km = distanceKm({ lat: 13.0011, lng: 77.5725 }, { lat: 12.9452, lng: 77.5759 });
    expect(km).toBeGreaterThan(6);
    expect(km).toBeLessThan(6.5);
  });
});

describe('formatDistance', () => {
  it('claims no more precision than a PIN centroid has', () => {
    expect(formatDistance(0.04)).toBe('≈ 100 m');
    expect(formatDistance(0.84)).toBe('≈ 800 m');
    expect(formatDistance(6.2)).toBe('≈ 6 km');
    expect(formatDistance(6.3)).toBe('≈ 6.5 km');
    expect(formatDistance(23.6)).toBe('≈ 24 km');
  });
});
