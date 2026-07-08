import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatDateYYYYMMDD,
  generateId,
  generateRandomString,
  getCurrentISOString,
  getTimeBasedShard,
  getTimestampFromId,
  isFuture,
  isPast,
  toISOString,
} from '.';

// test/setup.ts's global mocks target the phantom paths '../src/utils/dateTime' and
// '../src/utils/id', which don't correspond to any real file (only index.ts and
// transliteration.ts exist under utils/) — so those mocks are inert here and the real
// implementations below are exercised directly. The global system clock is frozen at
// 2025-01-15T12:00:00.000Z via vi.setSystemTime in that same setup file.

describe('generateId', () => {
  it('returns a KSUID-formatted string', () => {
    const id = generateId();

    expect(typeof id).toBe('string');
    expect(id).toHaveLength(27);
  });

  it('generates distinct ids across calls', () => {
    expect(generateId()).not.toBe(generateId());
  });
});

describe('generateRandomString', () => {
  it('defaults to length 6 using lowercase alphanumeric characters', () => {
    const str = generateRandomString();

    expect(str).toHaveLength(6);
    expect(str).toMatch(/^[0-9a-z]{6}$/);
  });

  it('respects a custom length', () => {
    expect(generateRandomString(12)).toHaveLength(12);
  });
});

describe('getCurrentISOString', () => {
  it('reflects the current (frozen) system time', () => {
    expect(getCurrentISOString()).toBe('2025-01-15T12:00:00.000Z');
  });
});

describe('formatDateYYYYMMDD', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(formatDateYYYYMMDD(new Date('2026-03-05T18:30:00.000Z'))).toBe('2026-03-05');
  });
});

describe('toISOString', () => {
  it('passes a Date through as ISO', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    expect(toISOString(date)).toBe('2026-01-01T00:00:00.000Z');
  });

  it('converts a date string', () => {
    expect(toISOString('2026-01-01')).toBe('2026-01-01T00:00:00.000Z');
  });

  it('converts a numeric epoch timestamp', () => {
    expect(toISOString(0)).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    const result = addDays(new Date('2026-01-01T00:00:00.000Z'), 5);
    expect(result.toISOString()).toBe('2026-01-06T00:00:00.000Z');
  });

  it('subtracts when given a negative number', () => {
    const result = addDays(new Date('2026-01-10T00:00:00.000Z'), -5);
    expect(result.toISOString()).toBe('2026-01-05T00:00:00.000Z');
  });
});

describe('isPast / isFuture', () => {
  it('treats a date before the frozen "now" as past', () => {
    expect(isPast('2020-01-01T00:00:00.000Z')).toBe(true);
    expect(isFuture('2020-01-01T00:00:00.000Z')).toBe(false);
  });

  it('treats a date after the frozen "now" as future', () => {
    expect(isFuture('2099-01-01T00:00:00.000Z')).toBe(true);
    expect(isPast('2099-01-01T00:00:00.000Z')).toBe(false);
  });
});

describe('daysBetween', () => {
  it('computes the absolute number of whole days between two dates', () => {
    expect(daysBetween('2026-01-01T00:00:00.000Z', '2026-01-10T00:00:00.000Z')).toBe(9);
  });

  it('is order-independent', () => {
    expect(daysBetween('2026-01-10T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(9);
  });
});

describe('getTimeBasedShard', () => {
  it('returns a shard number within the requested count', () => {
    const shard = getTimeBasedShard('1abc', 10);
    expect(shard).toBeGreaterThanOrEqual(0);
    expect(shard).toBeLessThan(10);
  });

  it('defaults the shard count to 10', () => {
    const shard = getTimeBasedShard('1abc');
    expect(shard).toBeGreaterThanOrEqual(0);
    expect(shard).toBeLessThan(10);
  });
});

describe('getTimestampFromId', () => {
  it('derives a Date from the leading base36 timestamp segment of an id', () => {
    const date = getTimestampFromId('1abc');
    expect(date).toBeInstanceOf(Date);
  });
});
