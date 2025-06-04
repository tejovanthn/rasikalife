/**
 * tRPC Rate Limiting Middleware
 *
 * Provides rate limiting functionality for tRPC procedures with support
 * for different limits per endpoint type and user authentication status.
 */

import { TRPCError } from '@trpc/server';
import {
  rateLimiter,
  RateLimitConfig,
  RateLimitConfigs,
  getRateLimitIdentifier,
  isTrustedSource,
} from '@rasika/core';
import { middleware } from '../server';
import type { Context } from '../context';

export interface RateLimitOptions {
  /** Rate limit configuration */
  config: RateLimitConfig;
  /** Optional custom identifier function */
  getIdentifier?: (ctx: Context) => string;
  /** Skip rate limiting based on context */
  skip?: (ctx: Context) => boolean;
}

/**
 * Create a rate limiting middleware for tRPC procedures
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  return middleware(async ({ ctx, next }) => {
    // Skip if configured to do so
    if (options.skip?.(ctx)) {
      return next();
    }

    // Get identifier for rate limiting
    const identifier = options.getIdentifier
      ? options.getIdentifier(ctx)
      : getRateLimitIdentifier(
          ctx.session?.user?.id,
          ctx.req?.ip || ctx.req?.socket?.remoteAddress
        );

    // Check if this is a trusted source
    if (isTrustedSource(identifier)) {
      return next();
    }

    // Apply rate limit
    const result = rateLimiter.checkLimit(identifier, options.config);

    // Set rate limit headers
    if (ctx.res) {
      ctx.res.setHeader('X-RateLimit-Limit', result.limit.toString());
      ctx.res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      ctx.res.setHeader(
        'X-RateLimit-Reset',
        Math.ceil((Date.now() + result.resetTime) / 1000).toString()
      );
    }

    // Check if rate limit exceeded
    if (!result.allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message:
          options.config.message ||
          `Rate limit exceeded. Try again in ${Math.ceil(result.resetTime / 1000)} seconds.`,
      });
    }

    return next();
  });
}

/**
 * Predefined rate limiting middlewares for common use cases
 */
export const RateLimitMiddleware = {
  /**
   * General purpose rate limiting for most endpoints
   */
  general: createRateLimitMiddleware({
    config: RateLimitConfigs.GENERAL,
  }),

  /**
   * Rate limiting for search operations
   */
  search: createRateLimitMiddleware({
    config: RateLimitConfigs.SEARCH,
  }),

  /**
   * Rate limiting for write operations (create, update, delete)
   */
  write: createRateLimitMiddleware({
    config: RateLimitConfigs.WRITE,
  }),

  /**
   * Rate limiting for view tracking (very permissive)
   */
  viewTracking: createRateLimitMiddleware({
    config: RateLimitConfigs.VIEW_TRACKING,
  }),

  /**
   * Stricter rate limiting for anonymous users
   */
  anonymous: createRateLimitMiddleware({
    config: RateLimitConfigs.ANONYMOUS,
    skip: ctx => !!ctx.session?.user?.id, // Skip for authenticated users
  }),

  /**
   * Rate limiting for authenticated users only
   */
  authenticated: createRateLimitMiddleware({
    config: RateLimitConfigs.GENERAL,
    skip: ctx => !ctx.session?.user?.id, // Skip for anonymous users
  }),
};

/**
 * Custom rate limiting for specific endpoints
 */
export function withRateLimit(config: RateLimitConfig) {
  return createRateLimitMiddleware({ config });
}

/**
 * Rate limiting based on user tier or subscription level
 */
export function createTierBasedRateLimit(
  configs: Record<string, RateLimitConfig>,
  getTier: (ctx: Context) => string = () => 'default'
) {
  return middleware(async ({ ctx, next }) => {
    const tier = getTier(ctx);
    const config = configs[tier] || configs.default;

    if (!config) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Rate limit configuration not found',
      });
    }

    const rateLimitFunc = createRateLimitMiddleware({ config });
    // Extract the actual middleware function from the tRPC middleware wrapper
    return rateLimitFunc({
      ctx,
      next,
      path: '',
      type: 'query',
      input: undefined,
      rawInput: undefined,
    });
  });
}
