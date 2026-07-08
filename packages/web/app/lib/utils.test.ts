import { describe, expect, it } from 'vitest';
import {
  buildSearchParams,
  capitalize,
  cn,
  extractIdFromSlug,
  formatDate,
  formatDateLocale,
  formatNumber,
  formatRelativeTime,
  handleApiError,
  slugify,
  truncateText,
} from './utils';

describe('cn', () => {
  it('merges class names and resolves Tailwind conflicts', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });
});

describe('slugify', () => {
  it('builds a composition slug by default when an id is given without a type', () => {
    const result = slugify({ name: 'Vatapi Ganapatim', id: 'comp-1' });

    expect(result).toBe('/carnatic/compositions/vatapi-ganapatim-comp-1');
  });

  it('builds an artist slug', () => {
    const result = slugify({ name: 'Sanjay Subrahmanyan', type: 'artists', id: 'artist-1' });

    expect(result).toBe('/artists/sanjay-subrahmanyan-artist-1');
  });

  it('builds a raga slug', () => {
    const result = slugify({ name: 'Hamsadhwani', type: 'ragas', id: 'raga-1' });

    expect(result).toBe('/carnatic/ragas/hamsadhwani-raga-1');
  });

  it('builds a tala slug', () => {
    const result = slugify({ name: 'Adi', type: 'talas', id: 'tala-1' });

    expect(result).toBe('/carnatic/talas/adi-tala-1');
  });

  it('falls back to a generic path when no id or recognized type is given', () => {
    const result = slugify({ name: 'Some Name' });

    expect(result).toBe('/carnatic/undefined/some-name');
  });
});

describe('extractIdFromSlug', () => {
  it('returns the last hyphen-delimited segment', () => {
    expect(extractIdFromSlug('vatapi-ganapatim-comp-1')).toBe('1');
  });

  it('returns null for an empty string', () => {
    expect(extractIdFromSlug('')).toBeNull();
  });
});

describe('capitalize', () => {
  it('capitalizes the first letter', () => {
    expect(capitalize('sanjay')).toBe('Sanjay');
  });

  it('returns falsy input unchanged', () => {
    expect(capitalize('')).toBe('');
  });
});

describe('truncateText', () => {
  it('leaves short text unchanged', () => {
    expect(truncateText('short', 10)).toBe('short');
  });

  it('truncates long text and appends an ellipsis', () => {
    expect(truncateText('a very long piece of text', 10)).toBe('a very lon...');
  });
});

describe('formatDate', () => {
  it('formats an ISO date as DD/MM/YYYY', () => {
    expect(formatDate('2026-03-05T00:00:00.000Z')).toBe('05/03/2026');
  });

  it('returns an empty string for null/undefined', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
});

describe('formatDateLocale', () => {
  it('returns an empty string for null/undefined', () => {
    expect(formatDateLocale(null)).toBe('');
    expect(formatDateLocale(undefined)).toBe('');
  });

  it('formats a real date to a non-empty locale string', () => {
    expect(formatDateLocale('2026-03-05T00:00:00.000Z').length).toBeGreaterThan(0);
  });
});

describe('formatRelativeTime', () => {
  it('returns an empty string for null/undefined', () => {
    expect(formatRelativeTime(null)).toBe('');
    expect(formatRelativeTime(undefined)).toBe('');
  });

  it('describes a date far in the past as "ago"', () => {
    expect(formatRelativeTime('2000-01-01T00:00:00.000Z')).toContain('ago');
  });
});

describe('formatNumber', () => {
  it('adds locale thousands separators', () => {
    expect(formatNumber(1234567)).toBe((1234567).toLocaleString());
  });
});

describe('buildSearchParams', () => {
  it('includes defined, non-empty, non-"all" values', () => {
    const params = buildSearchParams({ q: 'concert', page: 2, status: 'all', empty: '' });

    expect(params.get('q')).toBe('concert');
    expect(params.get('page')).toBe('2');
    expect(params.has('status')).toBe(false);
    expect(params.has('empty')).toBe(false);
  });

  it('omits undefined values', () => {
    const params = buildSearchParams({ q: undefined });

    expect(params.has('q')).toBe(false);
  });
});

describe('handleApiError', () => {
  it('passes through an existing Response unchanged', () => {
    const response = new Response('not found', { status: 404 });

    expect(handleApiError(response)).toBe(response);
  });

  it('wraps a non-Response error in a 500 Response', () => {
    const result = handleApiError(new Error('boom'));

    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(500);
  });
});
