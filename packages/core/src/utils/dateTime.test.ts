import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCurrentISOString,
  formatDateYYYYMMDD,
  toISOString,
  addDays,
  isPast,
  isFuture,
  daysBetween,
  getTimeBasedShard,
} from './dateTime';

describe('DateTime utilities', () => {
  beforeEach(() => {
    // Mock the current date to 2025-01-15T12:00:00.000Z
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gets current ISO string', () => {
    expect(getCurrentISOString()).toBe('2025-01-15T12:00:00.000Z');
  });

  it('formats date as YYYY-MM-DD', () => {
    const date = new Date('2025-01-15T12:00:00.000Z');
    expect(formatDateYYYYMMDD(date)).toBe('2025-01-15');
  });

  it('converts different date formats to ISO string', () => {
    const dateObj = new Date('2025-01-15T12:00:00.000Z');
    const dateStr = '2025-01-15T12:00:00.000Z';
    const dateNum = dateObj.getTime();

    expect(toISOString(dateObj)).toBe('2025-01-15T12:00:00.000Z');
    expect(toISOString(dateStr)).toBe('2025-01-15T12:00:00.000Z');
    expect(toISOString(dateNum)).toBe('2025-01-15T12:00:00.000Z');
  });

  it('adds days to a date', () => {
    const start = new Date('2025-01-15T12:00:00.000Z');
    const result = addDays(start, 5);
    expect(result.toISOString()).toBe('2025-01-20T12:00:00.000Z');
  });

  it('checks if a date is in the past', () => {
    const past = new Date('2025-01-10T12:00:00.000Z');
    const future = new Date('2025-01-20T12:00:00.000Z');

    expect(isPast(past)).toBe(true);
    expect(isPast(future)).toBe(false);
    expect(isPast('2025-01-10T12:00:00.000Z')).toBe(true);
  });

  it('checks if a date is in the future', () => {
    const past = new Date('2025-01-10T12:00:00.000Z');
    const future = new Date('2025-01-20T12:00:00.000Z');

    expect(isFuture(past)).toBe(false);
    expect(isFuture(future)).toBe(true);
    expect(isFuture('2025-01-20T12:00:00.000Z')).toBe(true);
  });

  it('calculates days between two dates', () => {
    const dateA = new Date('2025-01-10T12:00:00.000Z');
    const dateB = new Date('2025-01-15T18:00:00.000Z'); // Time shouldn't matter

    expect(daysBetween(dateA, dateB)).toBe(5);
    expect(daysBetween(dateB, dateA)).toBe(-5);
    expect(daysBetween('2025-01-10', '2025-01-15')).toBe(5);
  });

  it('generates a time-based shard key', () => {
    const id1 = 'test1';
    const id2 = 'test2';

    // Same ID should get same shard in same minute
    const shard1a = getTimeBasedShard(id1);
    const shard1b = getTimeBasedShard(id1);
    expect(shard1a).toBe(shard1b);

    // Different IDs should likely get different shards
    const shard2 = getTimeBasedShard(id2);
    // This could theoretically fail if they hash to same value, but unlikely
    expect(shard1a).not.toBe(shard2);

    // Shard should be within range
    expect(shard1a).toBeGreaterThanOrEqual(0);
    expect(shard1a).toBeLessThan(10);

    // Custom shard count
    const customShard = getTimeBasedShard(id1, 20);
    expect(customShard).toBeGreaterThanOrEqual(0);
    expect(customShard).toBeLessThan(20);
  });
});
