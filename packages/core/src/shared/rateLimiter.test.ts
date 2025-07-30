import { vi, describe, beforeEach, it, expect } from 'vitest';
import {
  rateLimiter,
  RateLimitConfigs,
  TrustedSources,
  isTrustedSource,
  getRateLimitIdentifier,
  performRateLimitCleanup,
} from './rateLimiter';

// Mock console.log for cleanup testing
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter.clear();
    vi.useRealTimers(); // Reset first
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const config = { max: 5, windowMs: 60000 };

      // Make 5 requests - all should be allowed
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.checkLimit('user1', config);
        expect(result.allowed).toBe(true);
        expect(result.count).toBe(i + 1);
        expect(result.remaining).toBe(4 - i);
        expect(result.limit).toBe(5);
      }
    });

    it('should block requests that exceed limit', () => {
      const config = { max: 3, windowMs: 60000 };

      // Make 3 allowed requests
      for (let i = 0; i < 3; i++) {
        const result = rateLimiter.checkLimit('user1', config);
        expect(result.allowed).toBe(true);
      }

      // 4th request should be blocked
      const blockedResult = rateLimiter.checkLimit('user1', config);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.count).toBe(3);
      expect(blockedResult.remaining).toBe(0);
      expect(blockedResult.resetTime).toBeGreaterThan(0);
    });

    it('should track different identifiers separately', () => {
      const config = { max: 2, windowMs: 60000 };

      // User1 makes 2 requests
      rateLimiter.checkLimit('user1', config);
      rateLimiter.checkLimit('user1', config);

      // User2 should still be allowed
      const user2Result = rateLimiter.checkLimit('user2', config);
      expect(user2Result.allowed).toBe(true);
      expect(user2Result.count).toBe(1);

      // User1 should be blocked
      const user1Result = rateLimiter.checkLimit('user1', config);
      expect(user1Result.allowed).toBe(false);
    });
  });

  describe('Sliding Window Algorithm', () => {
    it('should reset window when time advances', () => {
      const config = { max: 2, windowMs: 60000 }; // 1 minute window

      // Make 2 requests at time 0
      rateLimiter.checkLimit('user1', config);
      rateLimiter.checkLimit('user1', config);

      // Next request should be blocked
      let result = rateLimiter.checkLimit('user1', config);
      expect(result.allowed).toBe(false);

      // Advance time by 61 seconds (past the window)
      vi.advanceTimersByTime(61000);

      // Should be allowed again
      result = rateLimiter.checkLimit('user1', config);
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
    });

    it('should handle partial window overlap correctly', () => {
      const config = { max: 3, windowMs: 60000 };

      // Make 2 requests at time 0
      rateLimiter.checkLimit('user1', config);
      rateLimiter.checkLimit('user1', config);

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);

      // Make 1 more request (still within window)
      let result = rateLimiter.checkLimit('user1', config);
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(3);

      // Should be at limit
      result = rateLimiter.checkLimit('user1', config);
      expect(result.allowed).toBe(false);

      // Advance another 31 seconds (first 2 requests expire)
      vi.advanceTimersByTime(31000);

      // Should have capacity again (only 1 request in current window)
      result = rateLimiter.checkLimit('user1', config);
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(2); // 1 from before + 1 new
    });
  });

  describe('Skip Functionality', () => {
    it('should skip rate limiting when skip function returns true', () => {
      const config = {
        max: 1,
        windowMs: 60000,
        skip: (identifier: string) => identifier === 'admin',
      };

      // Admin should always be allowed
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.checkLimit('admin', config);
        expect(result.allowed).toBe(true);
        expect(result.count).toBe(0);
        expect(result.remaining).toBe(1);
      }

      // Regular user should be limited
      rateLimiter.checkLimit('user1', config);
      const result = rateLimiter.checkLimit('user1', config);
      expect(result.allowed).toBe(false);
    });
  });

  describe('Reset Time Calculation', () => {
    it('should calculate correct reset time', () => {
      const config = { max: 1, windowMs: 60000 };

      const startTime = Date.now();
      rateLimiter.checkLimit('user1', config);

      // Second request should be blocked with correct reset time
      const result = rateLimiter.checkLimit('user1', config);
      expect(result.allowed).toBe(false);
      expect(result.resetTime).toBeCloseTo(60000, -2); // Within 100ms
    });
  });

  describe('Cleanup Functionality', () => {
    it('should remove stale entries during cleanup', () => {
      const config = { max: 5, windowMs: 60000 };

      // Create entries for multiple users
      rateLimiter.checkLimit('user1', config);
      rateLimiter.checkLimit('user2', config);
      rateLimiter.checkLimit('user3', config);

      const initialStats = rateLimiter.getStats();
      expect(initialStats.totalIdentifiers).toBe(3);

      // Advance time by 6 minutes (past cleanup threshold)
      vi.advanceTimersByTime(6 * 60 * 1000);

      const deletedCount = rateLimiter.cleanup();
      expect(deletedCount).toBe(3);

      const finalStats = rateLimiter.getStats();
      expect(finalStats.totalIdentifiers).toBe(0);
    });

    it('should not remove recent entries during cleanup', () => {
      const config = { max: 5, windowMs: 60000 };

      rateLimiter.checkLimit('user1', config);

      // Advance time by only 2 minutes (less than cleanup threshold)
      vi.advanceTimersByTime(2 * 60 * 1000);

      const deletedCount = rateLimiter.cleanup();
      expect(deletedCount).toBe(0);

      const stats = rateLimiter.getStats();
      expect(stats.totalIdentifiers).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      const config = { max: 5, windowMs: 60000 };

      rateLimiter.checkLimit('user1', config);
      rateLimiter.checkLimit('user2', config);

      const stats = rateLimiter.getStats();
      expect(stats.totalIdentifiers).toBe(2);
      expect(stats.lastGlobalCleanup).toBeTypeOf('number');
    });
  });

  describe('Clear and Reset', () => {
    it('should clear all data', () => {
      const config = { max: 5, windowMs: 60000 };

      rateLimiter.checkLimit('user1', config);
      rateLimiter.checkLimit('user2', config);

      rateLimiter.clear();

      const stats = rateLimiter.getStats();
      expect(stats.totalIdentifiers).toBe(0);
    });

    it('should reset specific identifier', () => {
      const config = { max: 1, windowMs: 60000 };

      // Block user1
      rateLimiter.checkLimit('user1', config);
      rateLimiter.checkLimit('user1', config);

      let result = rateLimiter.checkLimit('user1', config);
      expect(result.allowed).toBe(false);

      // Reset user1
      rateLimiter.reset('user1');

      // Should be allowed again
      result = rateLimiter.checkLimit('user1', config);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Predefined Configurations', () => {
    it('should have correct general config', () => {
      expect(RateLimitConfigs.GENERAL).toEqual({
        max: 100,
        windowMs: 15 * 60 * 1000,
      });
    });

    it('should have correct search config', () => {
      expect(RateLimitConfigs.SEARCH).toEqual({
        max: 50,
        windowMs: 10 * 60 * 1000,
      });
    });

    it('should have correct write config', () => {
      expect(RateLimitConfigs.WRITE).toEqual({
        max: 20,
        windowMs: 15 * 60 * 1000,
      });
    });
  });

  describe('Trusted Sources', () => {
    it('should identify trusted development IPs', () => {
      expect(isTrustedSource('127.0.0.1')).toBe(true);
      expect(isTrustedSource('::1')).toBe(true);
      expect(isTrustedSource('localhost')).toBe(true);
      expect(isTrustedSource('192.168.1.1')).toBe(false);
    });

    it('should identify trusted service accounts', () => {
      expect(isTrustedSource('service-account-id')).toBe(true);
      expect(isTrustedSource('test-user-id')).toBe(true);
      expect(isTrustedSource('regular-user')).toBe(false);
    });
  });

  describe('Rate Limit Identifier', () => {
    it('should prefer user ID over IP', () => {
      const identifier = getRateLimitIdentifier('user123', '192.168.1.1');
      expect(identifier).toBe('user:user123');
    });

    it('should use IP when no user ID provided', () => {
      const identifier = getRateLimitIdentifier(undefined, '192.168.1.1');
      expect(identifier).toBe('ip:192.168.1.1');
    });

    it('should fallback to anonymous when neither provided', () => {
      const identifier = getRateLimitIdentifier(undefined, undefined);
      expect(identifier).toBe('anonymous');
    });
  });

  describe('Periodic Cleanup', () => {
    it('should log cleanup results when entries are deleted', () => {
      const config = { max: 5, windowMs: 60000 };

      // Create some entries
      rateLimiter.checkLimit('user1', config);
      rateLimiter.checkLimit('user2', config);

      // Advance time to make entries stale
      vi.advanceTimersByTime(6 * 60 * 1000);

      performRateLimitCleanup();

      expect(consoleSpy).toHaveBeenCalledWith('🧹 Rate limiter cleanup: removed 2 stale entries');
    });

    it('should not log when no entries are deleted', () => {
      performRateLimitCleanup();

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
