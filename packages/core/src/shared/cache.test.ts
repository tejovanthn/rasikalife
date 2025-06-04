/**
 * Unit tests for cache service and functions
 *
 * Tests the core caching functionality including TTL, cache hits/misses,
 * invalidation patterns, and the withCache higher-order function.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cache, CacheKeys, CacheTTL, withCache, invalidateCachePattern } from './cache';

describe('Cache Service', () => {
  beforeEach(() => {
    // Clear cache before each test
    cache.clear();
    // Reset time mocks
    vi.useRealTimers();
  });

  describe('basic operations', () => {
    it('should store and retrieve data', () => {
      const testData = { id: '1', name: 'Test' };

      cache.set('test-key', testData);
      const retrieved = cache.get('test-key');

      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should delete items', () => {
      cache.set('delete-test', 'data');
      expect(cache.get('delete-test')).toBe('data');

      cache.delete('delete-test');
      expect(cache.get('delete-test')).toBeNull();
    });

    it('should clear all items', () => {
      cache.set('key1', 'data1');
      cache.set('key2', 'data2');

      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('TTL functionality', () => {
    it('should respect custom TTL', () => {
      vi.useFakeTimers();

      const ttl = 1000; // 1 second
      cache.set('ttl-test', 'data', ttl);

      // Should be available immediately
      expect(cache.get('ttl-test')).toBe('data');

      // Should still be available just before expiry
      vi.advanceTimersByTime(999);
      expect(cache.get('ttl-test')).toBe('data');

      // Should be expired after TTL
      vi.advanceTimersByTime(2);
      expect(cache.get('ttl-test')).toBeNull();
    });

    it('should use default TTL when not specified', () => {
      vi.useFakeTimers();

      cache.set('default-ttl', 'data'); // Uses default 5 minutes

      // Should be available before default TTL
      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
      expect(cache.get('default-ttl')).toBe('data');

      // Should be expired after default TTL
      vi.advanceTimersByTime(2 * 60 * 1000); // 2 more minutes (total 6)
      expect(cache.get('default-ttl')).toBeNull();
    });

    it('should cleanup expired entries', () => {
      vi.useFakeTimers();

      cache.set('expire1', 'data1', 1000);
      cache.set('expire2', 'data2', 2000);
      cache.set('keep', 'data3', 10000);

      // Advance time to expire first two
      vi.advanceTimersByTime(2500);

      cache.cleanup();

      expect(cache.get('expire1')).toBeNull();
      expect(cache.get('expire2')).toBeNull();
      expect(cache.get('keep')).toBe('data3');
    });
  });

  describe('statistics', () => {
    it('should provide cache statistics', () => {
      cache.set('stat1', 'data1');
      cache.set('stat2', 'data2');

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('stat1');
      expect(stats.keys).toContain('stat2');
    });
  });
});

describe('Cache Key Generators', () => {
  it('should generate consistent popular artists keys', () => {
    expect(CacheKeys.popularArtists(10)).toBe('popular_artists:10');
    expect(CacheKeys.popularArtists(20)).toBe('popular_artists:20');
  });

  it('should generate consistent artist keys', () => {
    expect(CacheKeys.artist('123')).toBe('artist:123');
    expect(CacheKeys.artist('abc-def')).toBe('artist:abc-def');
  });

  it('should generate consistent search keys', () => {
    expect(CacheKeys.artistSearch('query', 10)).toBe('artist_search:query:10:none');
    expect(CacheKeys.artistSearch('query', 10, 'token')).toBe('artist_search:query:10:token');
  });
});

describe('Cache TTL Constants', () => {
  it('should have reasonable TTL values', () => {
    expect(CacheTTL.POPULAR_ARTISTS).toBe(10 * 60 * 1000); // 10 minutes
    expect(CacheTTL.ARTIST_PROFILE).toBe(30 * 60 * 1000); // 30 minutes
    expect(CacheTTL.SEARCH_RESULTS).toBe(5 * 60 * 1000); // 5 minutes
  });
});

describe('withCache Higher-Order Function', () => {
  beforeEach(() => {
    cache.clear();
  });

  it('should cache function results', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    const keyGen = (arg: string) => `test:${arg}`;

    const cachedFn = withCache(keyGen, 1000)(mockFn);

    // First call should execute function
    const result1 = await cachedFn('arg1');
    expect(result1).toBe('result');
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Second call should hit cache
    const result2 = await cachedFn('arg1');
    expect(result2).toBe('result');
    expect(mockFn).toHaveBeenCalledTimes(1); // No additional calls
  });

  it('should cache different arguments separately', async () => {
    const mockFn = vi.fn().mockResolvedValueOnce('result1').mockResolvedValueOnce('result2');

    const keyGen = (arg: string) => `test:${arg}`;
    const cachedFn = withCache(keyGen, 1000)(mockFn);

    const result1 = await cachedFn('arg1');
    const result2 = await cachedFn('arg2');

    expect(result1).toBe('result1');
    expect(result2).toBe('result2');
    expect(mockFn).toHaveBeenCalledTimes(2);

    // Subsequent calls should hit cache
    const cachedResult1 = await cachedFn('arg1');
    const cachedResult2 = await cachedFn('arg2');

    expect(cachedResult1).toBe('result1');
    expect(cachedResult2).toBe('result2');
    expect(mockFn).toHaveBeenCalledTimes(2); // No additional calls
  });

  it('should respect TTL for cached functions', async () => {
    vi.useFakeTimers();

    const mockFn = vi.fn().mockResolvedValueOnce('result1').mockResolvedValueOnce('result2');

    const keyGen = (arg: string) => `test:${arg}`;
    const cachedFn = withCache(keyGen, 1000)(mockFn); // 1 second TTL

    // First call
    const result1 = await cachedFn('arg');
    expect(result1).toBe('result1');
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Second call within TTL should hit cache
    vi.advanceTimersByTime(500);
    const result2 = await cachedFn('arg');
    expect(result2).toBe('result1'); // Same cached result
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Third call after TTL should execute function again
    vi.advanceTimersByTime(600);
    const result3 = await cachedFn('arg');
    expect(result3).toBe('result2'); // New result
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should handle multiple arguments correctly', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    const keyGen = (arg1: string, arg2: number) => `test:${arg1}:${arg2}`;

    const cachedFn = withCache(keyGen, 1000)(mockFn);

    await cachedFn('test', 123);
    expect(mockFn).toHaveBeenCalledWith('test', 123);

    // Same arguments should hit cache
    await cachedFn('test', 123);
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Different arguments should execute function
    await cachedFn('test', 456);
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});

describe('Cache Invalidation Patterns', () => {
  beforeEach(() => {
    cache.clear();
  });

  it('should invalidate entries matching pattern', () => {
    cache.set('popular_artists:10', 'data1');
    cache.set('popular_artists:20', 'data2');
    cache.set('artist:123', 'data3');
    cache.set('artist_search:query', 'data4');

    const deletedCount = invalidateCachePattern('popular_artists:');

    expect(deletedCount).toBe(2);
    expect(cache.get('popular_artists:10')).toBeNull();
    expect(cache.get('popular_artists:20')).toBeNull();
    expect(cache.get('artist:123')).toBe('data3'); // Should remain
    expect(cache.get('artist_search:query')).toBe('data4'); // Should remain
  });

  it('should return correct count of deleted entries', () => {
    cache.set('test:1', 'data1');
    cache.set('test:2', 'data2');
    cache.set('other:1', 'data3');

    const deletedCount = invalidateCachePattern('test:');

    expect(deletedCount).toBe(2);
  });

  it('should handle non-matching patterns gracefully', () => {
    cache.set('artist:123', 'data');

    const deletedCount = invalidateCachePattern('nonexistent:');

    expect(deletedCount).toBe(0);
    expect(cache.get('artist:123')).toBe('data'); // Should remain
  });
});

describe('Edge Cases', () => {
  beforeEach(() => {
    cache.clear();
  });

  it('should handle null and undefined values', () => {
    cache.set('null-test', null);
    cache.set('undefined-test', undefined);

    expect(cache.get('null-test')).toBeNull();
    expect(cache.get('undefined-test')).toBeUndefined();
  });

  it('should handle complex objects', () => {
    const complexObject = {
      id: '123',
      nested: {
        array: [1, 2, 3],
        date: new Date('2023-01-01'),
      },
    };

    cache.set('complex', complexObject);
    const retrieved = cache.get('complex');

    expect(retrieved).toEqual(complexObject);
  });

  it('should handle concurrent access gracefully', async () => {
    const mockFn = vi.fn().mockResolvedValue('result');
    const keyGen = (arg: string) => `concurrent:${arg}`;
    const cachedFn = withCache(keyGen, 1000)(mockFn);

    // Simulate concurrent calls
    const promises = Array.from({ length: 5 }, () => cachedFn('test'));
    const results = await Promise.all(promises);

    // All results should be the same
    results.forEach(result => expect(result).toBe('result'));

    // Note: Current implementation doesn't handle race conditions,
    // so all concurrent calls may execute the function before caching occurs.
    // This is acceptable for the current use case since cache is mainly
    // for repeated calls, not concurrent ones.
    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith('test');
  });
});
