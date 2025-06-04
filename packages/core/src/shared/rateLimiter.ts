/**
 * Rate Limiting Implementation with Sliding Window Algorithm
 *
 * Provides flexible rate limiting with per-user, per-IP, and per-endpoint
 * configurations. Uses in-memory storage suitable for serverless environments.
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  max: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional message when rate limit is exceeded */
  message?: string;
  /** Skip rate limiting for certain conditions */
  skip?: (identifier: string) => boolean;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current count of requests in window */
  count: number;
  /** Maximum requests allowed */
  limit: number;
  /** Milliseconds until window resets */
  resetTime: number;
  /** Remaining requests in current window */
  remaining: number;
}

interface RateLimitEntry {
  /** Array of request timestamps */
  requests: number[];
  /** Last cleanup time to prevent memory leaks */
  lastCleanup: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private lastGlobalCleanup = Date.now();

  /**
   * Check if a request is allowed under the rate limit
   *
   * @param identifier Unique identifier (user ID, IP address, etc.)
   * @param config Rate limit configuration
   * @returns Rate limit result
   */
  checkLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
    // Skip if configured to do so
    if (config.skip?.(identifier)) {
      return {
        allowed: true,
        count: 0,
        limit: config.max,
        resetTime: 0,
        remaining: config.max,
      };
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get or create entry for this identifier
    let entry = this.store.get(identifier);
    if (!entry) {
      entry = { requests: [], lastCleanup: now };
      this.store.set(identifier, entry);
    }

    // Remove old requests outside the window
    this.cleanupEntry(entry, windowStart);

    // Count current requests in window
    const currentCount = entry.requests.length;

    // Check if limit would be exceeded
    if (currentCount >= config.max) {
      const oldestRequest = Math.min(...entry.requests);
      const resetTime = oldestRequest + config.windowMs - now;

      return {
        allowed: false,
        count: currentCount,
        limit: config.max,
        resetTime: Math.max(0, resetTime),
        remaining: 0,
      };
    }

    // Allow the request and record it
    entry.requests.push(now);

    // Calculate reset time (when oldest request will expire)
    const oldestRequest = Math.min(...entry.requests);
    const resetTime = oldestRequest + config.windowMs - now;

    return {
      allowed: true,
      count: currentCount + 1,
      limit: config.max,
      resetTime: Math.max(0, resetTime),
      remaining: config.max - (currentCount + 1),
    };
  }

  /**
   * Clean up old requests from an entry
   */
  private cleanupEntry(entry: RateLimitEntry, windowStart: number): void {
    entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);
    entry.lastCleanup = Date.now();
  }

  /**
   * Perform global cleanup to prevent memory leaks
   * Should be called periodically
   */
  cleanup(): number {
    const now = Date.now();
    let deletedEntries = 0;

    // Clean up entries that haven't been accessed recently
    for (const [identifier, entry] of this.store.entries()) {
      // If entry hasn't been cleaned up in 5 minutes, remove it
      if (now - entry.lastCleanup > 5 * 60 * 1000) {
        this.store.delete(identifier);
        deletedEntries++;
      }
    }

    this.lastGlobalCleanup = now;
    return deletedEntries;
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      totalIdentifiers: this.store.size,
      lastGlobalCleanup: this.lastGlobalCleanup,
    };
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Remove rate limit data for a specific identifier
   */
  reset(identifier: string): void {
    this.store.delete(identifier);
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Predefined rate limit configurations
 */
export const RateLimitConfigs = {
  // General API usage
  GENERAL: {
    max: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },

  // Search operations (more permissive)
  SEARCH: {
    max: 50,
    windowMs: 10 * 60 * 1000, // 10 minutes
  },

  // Write operations (more restrictive)
  WRITE: {
    max: 20,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },

  // View tracking (very permissive)
  VIEW_TRACKING: {
    max: 200,
    windowMs: 10 * 60 * 1000, // 10 minutes
  },

  // Strict limits for unauthenticated users
  ANONYMOUS: {
    max: 30,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
} as const;

/**
 * Trusted sources that bypass rate limiting
 * Add IP addresses, user IDs, or other identifiers
 */
export const TrustedSources = {
  // Development and testing
  DEV_IPS: ['127.0.0.1', '::1', 'localhost'],

  // Service accounts (add specific user IDs)
  SERVICE_ACCOUNTS: ['service-account-id', 'test-user-id'],

  // Load balancer health checks
  HEALTH_CHECK_IPS: [],
} as const;

/**
 * Check if an identifier should be exempt from rate limiting
 */
export function isTrustedSource(identifier: string): boolean {
  return (
    TrustedSources.DEV_IPS.includes(identifier as any) ||
    TrustedSources.SERVICE_ACCOUNTS.includes(identifier as any) ||
    TrustedSources.HEALTH_CHECK_IPS.includes(identifier as any)
  );
}

/**
 * Get the appropriate identifier for rate limiting
 */
export function getRateLimitIdentifier(userId?: string, ip?: string): string {
  // Prefer user ID for authenticated requests
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP for anonymous requests
  if (ip) {
    return `ip:${ip}`;
  }

  // Fallback identifier
  return 'anonymous';
}

/**
 * Periodic cleanup function - call this in a background process
 */
export function performRateLimitCleanup(): void {
  const deletedEntries = rateLimiter.cleanup();
  if (deletedEntries > 0) {
    console.log(`🧹 Rate limiter cleanup: removed ${deletedEntries} stale entries`);
  }
}
