import { describe, expect, it } from 'vitest';
import { canonicalCitySlug, citySlug, foldCities } from './city';

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

describe('foldCities', () => {
  it('folds spellings of one city and names it by the commoner one', () => {
    expect(foldCities(['Bengaluru', 'Bengaluru', 'Bangalore', 'Mysuru', '', undefined])).toEqual([
      { slug: 'bengaluru', name: 'Bengaluru', count: 3 },
      { slug: 'mysuru', name: 'Mysuru', count: 1 },
    ]);
  });
});
