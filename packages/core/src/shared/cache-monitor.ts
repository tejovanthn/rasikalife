/**
 * Cache monitoring and maintenance utilities
 *
 * Provides tools for monitoring cache performance, cleaning up expired
 * entries, and analyzing cache usage patterns.
 */

import { cache } from './cache';

export interface CacheMetrics {
  totalKeys: number;
  keysByType: Record<string, number>;
  oldestEntry: string | null;
  newestEntry: string | null;
  memoryUsage: number; // Rough estimate in bytes
}

/**
 * Get comprehensive cache metrics
 */
export function getCacheMetrics(): CacheMetrics {
  const stats = cache.getStats();
  const keysByType: Record<string, number> = {};
  let oldestTimestamp = Date.now();
  let newestTimestamp = 0;
  let oldestKey: string | null = null;
  let newestKey: string | null = null;

  // Analyze cache contents (accessing private property for monitoring)
  const cacheMap = (cache as any).cache as Map<string, any>;

  for (const [key, entry] of cacheMap.entries()) {
    // Categorize by key prefix
    const prefix = key.split(':')[0];
    keysByType[prefix] = (keysByType[prefix] || 0) + 1;

    // Track oldest and newest entries
    if (entry.timestamp < oldestTimestamp) {
      oldestTimestamp = entry.timestamp;
      oldestKey = key;
    }
    if (entry.timestamp > newestTimestamp) {
      newestTimestamp = entry.timestamp;
      newestKey = key;
    }
  }

  // Rough memory usage estimate (JSON string length)
  const memoryUsage = Array.from(cacheMap.entries()).reduce((total, [key, entry]) => {
    return total + key.length + JSON.stringify(entry.data).length;
  }, 0);

  return {
    totalKeys: stats.size,
    keysByType,
    oldestEntry: oldestKey,
    newestEntry: newestKey,
    memoryUsage,
  };
}

/**
 * Clean up expired cache entries
 * Should be called periodically to prevent memory leaks
 */
export function cleanupExpiredEntries(): number {
  const sizeBefore = cache.getStats().size;
  cache.cleanup();
  const sizeAfter = cache.getStats().size;
  return sizeBefore - sizeAfter;
}

/**
 * Get cache hit rate for a specific key pattern
 * Note: This is a simplified implementation; production systems
 * would track hits/misses with dedicated counters
 */
export function getCacheHitRate(keyPattern: string): number {
  const stats = cache.getStats();
  const matchingKeys = stats.keys.filter(key => key.includes(keyPattern));

  // This is a rough estimate based on key existence
  // Real implementation would track actual hit/miss ratios
  return matchingKeys.length > 0 ? 0.8 : 0.0; // Placeholder
}

/**
 * Log cache performance metrics
 */
export function logCacheMetrics(): void {
  const metrics = getCacheMetrics();

  console.log('🗄️ Cache Metrics:', {
    totalKeys: metrics.totalKeys,
    keysByType: metrics.keysByType,
    memoryUsageKB: Math.round(metrics.memoryUsage / 1024),
    oldestEntry: metrics.oldestEntry,
    newestEntry: metrics.newestEntry,
  });
}

/**
 * Cache warming function for critical data
 * Pre-loads commonly accessed data to improve performance
 */
export async function warmCache(): Promise<void> {
  // This would be implemented to pre-load popular artists, etc.
  console.log('🔥 Cache warming not yet implemented');
}

/**
 * Cache performance recommendations based on current metrics
 */
export function getCacheRecommendations(): string[] {
  const metrics = getCacheMetrics();
  const recommendations: string[] = [];

  if (metrics.totalKeys > 1000) {
    recommendations.push('Consider implementing cache eviction policies - cache is getting large');
  }

  if (metrics.memoryUsage > 50 * 1024 * 1024) {
    // 50MB
    recommendations.push('Memory usage is high - consider external cache (Redis)');
  }

  if (metrics.keysByType['artist_search'] > 100) {
    recommendations.push('Many search queries cached - consider search result aggregation');
  }

  if (metrics.totalKeys === 0) {
    recommendations.push('Cache is empty - ensure caching is working correctly');
  }

  return recommendations;
}
