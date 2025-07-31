import { RateLimitConfigs, rateLimiter } from '@rasika/core';
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Context } from '../context';
import {
  RateLimitMiddleware,
  createRateLimitMiddleware,
  createTierBasedRateLimit,
  withRateLimit,
} from './rateLimit';

// Mock context creation helper
const createMockContext = (overrides: Partial<Context> = {}): Context => ({
  session: null,
  req: {
    headers: {},
    cookies: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  },
  res: {
    setHeader: vi.fn(),
    status: vi.fn(),
  },
  isBot: false,
  ...overrides,
});

// Mock next function
const mockNext = vi.fn();

describe('Rate Limiting Middleware Tests', () => {
  beforeEach(() => {
    // Clear rate limiter state before each test
    rateLimiter.clear();
    vi.clearAllMocks();
  });

  describe('createRateLimitMiddleware', () => {
    it('should allow requests within rate limit', async () => {
      const middleware = createRateLimitMiddleware({
        config: RateLimitConfigs.GENERAL,
      });

      const ctx = createMockContext();
      mockNext.mockResolvedValue('success');

      const result = await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(result).toBe('success');
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(ctx.res?.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
      expect(ctx.res?.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
      expect(ctx.res?.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    it('should block requests exceeding rate limit', async () => {
      const restrictiveConfig = {
        ...RateLimitConfigs.GENERAL,
        requests: 1, // Very restrictive
        window: 60000,
      };

      const middleware = createRateLimitMiddleware({
        config: restrictiveConfig,
      });

      const ctx = createMockContext();

      // First request should succeed
      await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      // Second request should be blocked
      await expect(
        middleware({
          ctx,
          next: mockNext,
          path: 'test.path',
          type: 'query',
          input: undefined,
          rawInput: undefined,
        })
      ).rejects.toThrow(TRPCError);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should skip rate limiting when skip function returns true', async () => {
      const middleware = createRateLimitMiddleware({
        config: { requests: 1, window: 60000 }, // Very restrictive
        skip: () => true, // Always skip
      });

      const ctx = createMockContext();
      mockNext.mockResolvedValue('success');

      // Multiple requests should succeed despite restrictive limit
      await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    it('should use custom identifier function when provided', async () => {
      const customIdentifier = vi.fn().mockReturnValue('custom-id');
      const middleware = createRateLimitMiddleware({
        config: RateLimitConfigs.GENERAL,
        getIdentifier: customIdentifier,
      });

      const ctx = createMockContext();
      mockNext.mockResolvedValue('success');

      await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(customIdentifier).toHaveBeenCalledWith(ctx);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should bypass rate limiting for trusted sources', async () => {
      // Test with a user ID that should be treated as trusted (test-user-id)
      const ctx = createMockContext({
        session: {
          user: {
            id: 'test-user-id', // This should be trusted
            email: 'test@example.com',
          },
        },
      });

      const restrictiveConfig = {
        requests: 1,
        window: 60000,
      };

      const middleware = createRateLimitMiddleware({
        config: restrictiveConfig,
      });

      mockNext.mockResolvedValue('success');

      // Multiple requests should succeed for trusted source
      await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    it('should set custom error message when provided', async () => {
      const customMessage = 'Custom rate limit exceeded message';
      const middleware = createRateLimitMiddleware({
        config: {
          requests: 1,
          window: 60000,
          message: customMessage,
        },
      });

      const ctx = createMockContext();

      // First request
      await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      // Second request should throw with custom message
      try {
        await middleware({
          ctx,
          next: mockNext,
          path: 'test.path',
          type: 'query',
          input: undefined,
          rawInput: undefined,
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error instanceof TRPCError).toBe(true);
        expect((error as TRPCError).message).toBe(customMessage);
      }
    });
  });

  describe('predefined rate limiting middlewares', () => {
    it('should have general rate limiting middleware', async () => {
      const ctx = createMockContext();
      mockNext.mockResolvedValue('success');

      const result = await RateLimitMiddleware.general({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(result).toBe('success');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should have search rate limiting middleware', async () => {
      const ctx = createMockContext();
      mockNext.mockResolvedValue('success');

      const result = await RateLimitMiddleware.search({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(result).toBe('success');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should have write rate limiting middleware', async () => {
      const ctx = createMockContext();
      mockNext.mockResolvedValue('success');

      const result = await RateLimitMiddleware.write({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'mutation',
        input: undefined,
        rawInput: undefined,
      });

      expect(result).toBe('success');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should have view tracking rate limiting middleware', async () => {
      const ctx = createMockContext();
      mockNext.mockResolvedValue('success');

      const result = await RateLimitMiddleware.viewTracking({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(result).toBe('success');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should skip anonymous middleware for authenticated users', async () => {
      const ctx = createMockContext({
        session: {
          user: {
            id: 'authenticated-user',
            email: 'user@example.com',
          },
        },
      });
      mockNext.mockResolvedValue('success');

      const result = await RateLimitMiddleware.anonymous({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(result).toBe('success');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should apply anonymous middleware for unauthenticated users', async () => {
      const ctx = createMockContext(); // No session
      mockNext.mockResolvedValue('success');

      const result = await RateLimitMiddleware.anonymous({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(result).toBe('success');
      expect(mockNext).toHaveBeenCalledTimes(1);
      // Should have set rate limit headers
      expect(ctx.res?.setHeader).toHaveBeenCalled();
    });

    it('should skip authenticated middleware for anonymous users', async () => {
      const ctx = createMockContext(); // No session
      mockNext.mockResolvedValue('success');

      const result = await RateLimitMiddleware.authenticated({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(result).toBe('success');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should apply authenticated middleware for authenticated users', async () => {
      const ctx = createMockContext({
        session: {
          user: {
            id: 'authenticated-user',
            email: 'user@example.com',
          },
        },
      });
      mockNext.mockResolvedValue('success');

      const result = await RateLimitMiddleware.authenticated({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(result).toBe('success');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('withRateLimit', () => {
    it('should create middleware with custom config', async () => {
      const customConfig = {
        requests: 5,
        window: 30000,
        message: 'Custom limit reached',
      };

      const middleware = withRateLimit(customConfig);
      const ctx = createMockContext();
      mockNext.mockResolvedValue('success');

      const result = await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(result).toBe('success');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('createTierBasedRateLimit', () => {
    it('should use default tier when getTier is not provided', async () => {
      const configs = {
        default: RateLimitConfigs.GENERAL,
        premium: RateLimitConfigs.WRITE,
      };

      const middleware = createTierBasedRateLimit(configs);
      const ctx = createMockContext();
      mockNext.mockResolvedValue('success');

      const result = await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(result).toBe('success');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should use custom tier when getTier function is provided', async () => {
      const configs = {
        default: { requests: 10, window: 60000 },
        premium: { requests: 100, window: 60000 },
      };

      const getTier = vi.fn().mockReturnValue('premium');
      const middleware = createTierBasedRateLimit(configs, getTier);
      const ctx = createMockContext();
      mockNext.mockResolvedValue('success');

      const result = await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(getTier).toHaveBeenCalledWith(ctx);
      expect(result).toBe('success');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should throw error when config is not found', async () => {
      const configs = {
        default: RateLimitConfigs.GENERAL,
      };

      const getTier = vi.fn().mockReturnValue('nonexistent');
      const middleware = createTierBasedRateLimit(configs, getTier);
      const ctx = createMockContext();

      await expect(
        middleware({
          ctx,
          next: mockNext,
          path: 'test.path',
          type: 'query',
          input: undefined,
          rawInput: undefined,
        })
      ).rejects.toThrow(TRPCError);

      const error = await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      }).catch(e => e);

      expect(error instanceof TRPCError).toBe(true);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(error.message).toBe('Rate limit configuration not found');
    });

    it('should fallback to default config when tier config is missing', async () => {
      const configs = {
        default: RateLimitConfigs.GENERAL,
        premium: RateLimitConfigs.WRITE,
      };

      const getTier = vi.fn().mockReturnValue('nonexistent');
      const middleware = createTierBasedRateLimit(configs, getTier);
      const ctx = createMockContext();
      mockNext.mockResolvedValue('success');

      const result = await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(result).toBe('success');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should throw TOO_MANY_REQUESTS error when rate limit exceeded', async () => {
      const middleware = createRateLimitMiddleware({
        config: { requests: 1, window: 60000 },
      });

      const ctx = createMockContext();

      // First request
      await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      // Second request should throw
      try {
        await middleware({
          ctx,
          next: mockNext,
          path: 'test.path',
          type: 'query',
          input: undefined,
          rawInput: undefined,
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error instanceof TRPCError).toBe(true);
        expect((error as TRPCError).code).toBe('TOO_MANY_REQUESTS');
        expect((error as TRPCError).message).toContain('Rate limit exceeded');
      }
    });

    it('should handle missing response object gracefully', async () => {
      const middleware = createRateLimitMiddleware({
        config: RateLimitConfigs.GENERAL,
      });

      const ctx = createMockContext({ res: undefined });
      mockNext.mockResolvedValue('success');

      // Should not throw even without response object
      const result = await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(result).toBe('success');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('rate limit headers', () => {
    it('should set correct rate limit headers', async () => {
      const middleware = createRateLimitMiddleware({
        config: { requests: 10, window: 60000 },
      });

      const ctx = createMockContext();
      const setHeaderSpy = vi.fn();
      ctx.res!.setHeader = setHeaderSpy;
      mockNext.mockResolvedValue('success');

      await middleware({
        ctx,
        next: mockNext,
        path: 'test.path',
        type: 'query',
        input: undefined,
        rawInput: undefined,
      });

      expect(setHeaderSpy).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(setHeaderSpy).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
      expect(setHeaderSpy).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });
  });
});
