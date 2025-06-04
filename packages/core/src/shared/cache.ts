/**
 * Simple in-memory cache service for serverless environments
 *
 * This provides basic caching functionality that persists across function
 * invocations within the same container. For production use, consider
 * upgrading to Redis/ElastiCache for distributed caching.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class CacheService {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Get item from cache
   *
   * @param key Cache key
   * @returns Cached data or null if expired/missing
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set item in cache
   *
   * @param key Cache key
   * @param data Data to cache
   * @param ttlMs Time to live in milliseconds (default: 5 minutes)
   */
  set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  /**
   * Delete item from cache
   *
   * @param key Cache key to delete
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const cache = new CacheService();

/**
 * Cache key generators for consistent naming
 */
export const CacheKeys = {
  popularArtists: (limit: number) => `popular_artists:${limit}`,
  artist: (id: string) => `artist:${id}`,
  artistSearch: (query: string, limit: number, nextToken?: string) =>
    `artist_search:${query}:${limit}:${nextToken || 'none'}`,
} as const;

/**
 * Cache TTL constants (in milliseconds)
 */
export const CacheTTL = {
  POPULAR_ARTISTS: 10 * 60 * 1000, // 10 minutes
  ARTIST_PROFILE: 30 * 60 * 1000, // 30 minutes
  SEARCH_RESULTS: 5 * 60 * 1000, // 5 minutes
} as const;

/**
 * Curried caching function that wraps async operations with caching logic
 *
 * @param keyGenerator Function to generate cache key from arguments
 * @param ttl Time to live in milliseconds
 * @returns Curried function that wraps async operations with caching
 *
 * @example
 * const cachedGetArtist = withCache(
 *   (id: string) => CacheKeys.artist(id),
 *   CacheTTL.ARTIST_PROFILE
 * )(ArtistRepository.getById);
 *
 * const artist = await cachedGetArtist('artist-123');
 */
export function withCache<TArgs extends readonly unknown[], TResult>(
  keyGenerator: (...args: TArgs) => string,
  ttl: number
) {
  return function <TFunc extends (...args: TArgs) => Promise<TResult>>(
    fn: TFunc
  ): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs): Promise<TResult> => {
      const cacheKey = keyGenerator(...args);

      // Check cache first
      const cached = cache.get<TResult>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Execute function and cache result
      const result = await fn(...args);
      cache.set(cacheKey, result, ttl);

      return result;
    };
  };
}

/**
 * Invalidates cache entries matching a pattern
 * Useful for bulk invalidation when data changes
 *
 * @param pattern Pattern to match cache keys (supports startsWith)
 */
export function invalidateCachePattern(pattern: string): number {
  const stats = cache.getStats();
  let deletedCount = 0;

  stats.keys.forEach(key => {
    if (key.startsWith(pattern)) {
      cache.delete(key);
      deletedCount++;
    }
  });

  return deletedCount;
}
