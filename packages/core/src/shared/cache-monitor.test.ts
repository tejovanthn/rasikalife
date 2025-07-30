import { vi, describe, beforeEach, it, expect } from 'vitest';
import {
  getCacheMetrics,
  cleanupExpiredEntries,
  getCacheHitRate,
  logCacheMetrics,
  warmCache,
  getCacheRecommendations,
} from './cache-monitor';

// Mock the cache module with factory function
vi.mock('./cache', () => {
  const mockInternalCache = new Map();
  const mockCacheService = {
    getStats: vi.fn(() => ({ size: 0, keys: [] })),
    cleanup: vi.fn(() => {}),
    cache: mockInternalCache,
  };

  // Store references on global for test access
  (globalThis as any).__mockCacheService = mockCacheService;
  (globalThis as any).__mockInternalCache = mockInternalCache;

  return {
    cache: mockCacheService,
  };
});

// Mock console.log for testing log output
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Cache Monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Get mock references from global
    const mockInternalCache = (globalThis as any).__mockInternalCache;
    const mockCacheService = (globalThis as any).__mockCacheService;

    mockInternalCache.clear();
    mockCacheService.getStats.mockReturnValue({ size: 0, keys: [] });
  });

  describe('getCacheMetrics', () => {
    it('should return empty metrics when cache is empty', () => {
      const metrics = getCacheMetrics();

      expect(metrics).toEqual({
        totalKeys: 0,
        keysByType: {},
        oldestEntry: null,
        newestEntry: null,
        memoryUsage: 0,
      });
    });

    it('should categorize keys by prefix and calculate memory usage', () => {
      const now = Date.now();
      const mockInternalCache = (globalThis as any).__mockInternalCache;
      const mockCacheService = (globalThis as any).__mockCacheService;

      // Set up mock cache with sample data
      mockInternalCache.set('artist:123', {
        data: { name: 'Test Artist' },
        timestamp: now - 1000,
        ttl: 300000,
      });
      mockInternalCache.set('composition:456', {
        data: { title: 'Test Composition' },
        timestamp: now,
        ttl: 300000,
      });
      mockInternalCache.set('artist:789', {
        data: { name: 'Another Artist' },
        timestamp: now - 500,
        ttl: 300000,
      });

      mockCacheService.getStats.mockReturnValue({
        size: 3,
        keys: ['artist:123', 'composition:456', 'artist:789'],
      });

      const metrics = getCacheMetrics();

      expect(metrics.totalKeys).toBe(3);
      expect(metrics.keysByType).toEqual({
        artist: 2,
        composition: 1,
      });
      expect(metrics.oldestEntry).toBe('artist:123');
      expect(metrics.newestEntry).toBe('composition:456');
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });

    it('should handle single entry cache', () => {
      const now = Date.now();
      const mockInternalCache = (globalThis as any).__mockInternalCache;
      const mockCacheService = (globalThis as any).__mockCacheService;

      mockInternalCache.set('raga:abc', {
        data: { name: 'Test Raga' },
        timestamp: now,
        ttl: 300000,
      });

      mockCacheService.getStats.mockReturnValue({ size: 1, keys: ['raga:abc'] });

      const metrics = getCacheMetrics();

      expect(metrics.totalKeys).toBe(1);
      expect(metrics.keysByType).toEqual({ raga: 1 });
      expect(metrics.oldestEntry).toBe('raga:abc');
      expect(metrics.newestEntry).toBe('raga:abc');
    });
  });

  describe('cleanupExpiredEntries', () => {
    it('should return count of cleaned entries', () => {
      const mockCacheService = (globalThis as any).__mockCacheService;

      mockCacheService.getStats
        .mockReturnValueOnce({ size: 10 }) // before cleanup
        .mockReturnValueOnce({ size: 7 }); // after cleanup

      const cleanedCount = cleanupExpiredEntries();

      expect(cleanedCount).toBe(3);
      expect(mockCacheService.cleanup).toHaveBeenCalledOnce();
    });

    it('should return 0 when no entries are cleaned', () => {
      const mockCacheService = (globalThis as any).__mockCacheService;

      mockCacheService.getStats.mockReturnValueOnce({ size: 5 }).mockReturnValueOnce({ size: 5 });

      const cleanedCount = cleanupExpiredEntries();

      expect(cleanedCount).toBe(0);
    });
  });

  describe('getCacheHitRate', () => {
    it('should return 0.8 when matching keys exist', () => {
      const mockCacheService = (globalThis as any).__mockCacheService;

      mockCacheService.getStats.mockReturnValue({
        keys: ['artist:123', 'artist:456', 'composition:789'],
      });

      const hitRate = getCacheHitRate('artist');

      expect(hitRate).toBe(0.8);
    });

    it('should return 0.0 when no matching keys exist', () => {
      const mockCacheService = (globalThis as any).__mockCacheService;

      mockCacheService.getStats.mockReturnValue({
        keys: ['composition:123', 'raga:456'],
      });

      const hitRate = getCacheHitRate('artist');

      expect(hitRate).toBe(0.0);
    });

    it('should handle empty cache', () => {
      const mockCacheService = (globalThis as any).__mockCacheService;

      mockCacheService.getStats.mockReturnValue({ keys: [] });

      const hitRate = getCacheHitRate('artist');

      expect(hitRate).toBe(0.0);
    });
  });

  describe('logCacheMetrics', () => {
    it('should log cache metrics to console', () => {
      const mockInternalCache = (globalThis as any).__mockInternalCache;
      const mockCacheService = (globalThis as any).__mockCacheService;

      mockCacheService.getStats.mockReturnValue({ size: 2, keys: [] });

      // Add some test data for memory calculation
      mockInternalCache.set('test:1', {
        data: { value: 'test' },
        timestamp: Date.now(),
        ttl: 300000,
      });

      logCacheMetrics();

      expect(consoleSpy).toHaveBeenCalledWith(
        '🗄️ Cache Metrics:',
        expect.objectContaining({
          totalKeys: expect.any(Number),
          keysByType: expect.any(Object),
          memoryUsageKB: expect.any(Number),
        })
      );
    });
  });

  describe('warmCache', () => {
    it('should log that cache warming is not implemented', async () => {
      await warmCache();

      expect(consoleSpy).toHaveBeenCalledWith('🔥 Cache warming not yet implemented');
    });
  });

  describe('getCacheRecommendations', () => {
    it('should recommend cache eviction for large cache', () => {
      const mockCacheService = (globalThis as any).__mockCacheService;

      mockCacheService.getStats.mockReturnValue({ size: 1500, keys: [] });

      const recommendations = getCacheRecommendations();

      expect(recommendations).toContain(
        'Consider implementing cache eviction policies - cache is getting large'
      );
    });

    it('should recommend external cache for high memory usage', () => {
      const mockInternalCache = (globalThis as any).__mockInternalCache;
      const mockCacheService = (globalThis as any).__mockCacheService;

      mockInternalCache.set('test', {
        data: 'x'.repeat(60 * 1024 * 1024), // 60MB of data
        timestamp: Date.now(),
        ttl: 300000,
      });
      mockCacheService.getStats.mockReturnValue({ size: 1, keys: ['test'] });

      const recommendations = getCacheRecommendations();

      expect(recommendations).toContain('Memory usage is high - consider external cache (Redis)');
    });

    it('should recommend search result aggregation for many artist searches', () => {
      const mockInternalCache = (globalThis as any).__mockInternalCache;
      const mockCacheService = (globalThis as any).__mockCacheService;

      mockCacheService.getStats.mockReturnValue({ size: 150, keys: [] });

      // Mock many artist search entries
      for (let i = 0; i < 150; i++) {
        mockInternalCache.set(`artist_search:${i}`, {
          data: { results: [] },
          timestamp: Date.now(),
          ttl: 300000,
        });
      }

      const recommendations = getCacheRecommendations();

      expect(recommendations).toContain(
        'Many search queries cached - consider search result aggregation'
      );
    });

    it('should warn when cache is empty', () => {
      const recommendations = getCacheRecommendations();

      expect(recommendations).toContain('Cache is empty - ensure caching is working correctly');
    });

    it('should return empty array for healthy cache', () => {
      const mockInternalCache = (globalThis as any).__mockInternalCache;
      const mockCacheService = (globalThis as any).__mockCacheService;

      mockCacheService.getStats.mockReturnValue({ size: 50, keys: [] });
      mockInternalCache.set('artist:1', {
        data: { name: 'Test' },
        timestamp: Date.now(),
        ttl: 300000,
      });

      const recommendations = getCacheRecommendations();

      expect(recommendations).toHaveLength(0);
    });

    it('should return multiple recommendations when applicable', () => {
      const mockInternalCache = (globalThis as any).__mockInternalCache;
      const mockCacheService = (globalThis as any).__mockCacheService;

      mockCacheService.getStats.mockReturnValue({ size: 1200, keys: [] });

      // Add large data to trigger memory warning
      mockInternalCache.set('large', {
        data: 'x'.repeat(60 * 1024 * 1024), // 60MB
        timestamp: Date.now(),
        ttl: 300000,
      });

      // Add many artist search entries
      for (let i = 0; i < 150; i++) {
        mockInternalCache.set(`artist_search:${i}`, {
          data: { results: [] },
          timestamp: Date.now(),
          ttl: 300000,
        });
      }

      const recommendations = getCacheRecommendations();

      expect(recommendations.length).toBeGreaterThan(1);
      expect(recommendations).toContain(
        'Consider implementing cache eviction policies - cache is getting large'
      );
      expect(recommendations).toContain('Memory usage is high - consider external cache (Redis)');
    });
  });
});
