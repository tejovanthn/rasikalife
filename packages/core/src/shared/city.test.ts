import { describe, expect, it } from 'vitest';
import { canonicalCitySlug, citySlug } from './city';

describe('citySlug', () => {
  it('lowercases, strips marks and joins words with hyphens', () => {
    expect(citySlug('Bengaluru')).toBe('bengaluru');
    expect(citySlug(' Redwood City ')).toBe('redwood-city');
    expect(citySlug('Tiruchirāppalli')).toBe('tiruchirappalli');
  });
});

describe('canonicalCitySlug', () => {
  it('resolves an old name to the stored one', () => {
    expect(canonicalCitySlug('Bangalore')).toBe('bengaluru');
    expect(canonicalCitySlug('mysore')).toBe('mysuru');
  });

  it('leaves a stored name alone', () => {
    expect(canonicalCitySlug('Chennai')).toBe('chennai');
  });
});
