import { initTRPC, TRPCError } from '@trpc/server';
import { ApplicationError } from '@rasika/core';
import type { Context } from './context';

// Initialize tRPC with context type
const t = initTRPC.context<Context>().create();

// Error handling middleware
const errorHandler = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Log the error
    console.error('tRPC error:', error);

    // Transform core package errors into tRPC errors
    if (error instanceof ApplicationError) {
      const code = mapErrorCodeToTRPCCode(error.code);
      throw new TRPCError({
        code,
        message: error.message,
        cause: error,
      });
    }

    // Handle tRPC errors - pass through
    if (error instanceof TRPCError) {
      throw error;
    }

    // Re-throw other errors as INTERNAL_SERVER_ERROR
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      cause: error,
    });
  }
});

// Helper to map application error codes to tRPC error codes
function mapErrorCodeToTRPCCode(code: string): TRPCError['code'] {
  if (code.includes('NOT_FOUND')) return 'NOT_FOUND';
  if (code.includes('UNAUTHORIZED')) return 'UNAUTHORIZED';
  if (code.includes('FORBIDDEN')) return 'FORBIDDEN';
  if (code.includes('BAD_REQUEST')) return 'BAD_REQUEST';
  if (code.includes('CONFLICT')) return 'CONFLICT';
  return 'INTERNAL_SERVER_ERROR';
}

// Middleware that checks if user is authenticated
const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }
  return next({
    ctx: {
      // Add user info to context
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});

// Public procedures - no authentication required
export const publicProcedure = t.procedure.use(errorHandler);

// Protected procedures - requires authentication
export const protectedProcedure = publicProcedure.use(isAuthed);

// Rate limited procedures
import {
  rateLimiter,
  RateLimitConfigs,
  getRateLimitIdentifier,
  isTrustedSource,
} from '@rasika/core';

// General rate limiting middleware
const generalRateLimit = t.middleware(async ({ ctx, next }) => {
  const identifier = getRateLimitIdentifier(
    ctx.session?.user?.id,
    ctx.req?.headers['x-forwarded-for'] || ctx.req?.headers['x-real-ip'] || 'unknown'
  );

  if (!isTrustedSource(identifier)) {
    const result = rateLimiter.checkLimit(identifier, RateLimitConfigs.GENERAL);

    if (ctx.res) {
      ctx.res.setHeader('X-RateLimit-Limit', result.limit.toString());
      ctx.res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      ctx.res.setHeader(
        'X-RateLimit-Reset',
        Math.ceil((Date.now() + result.resetTime) / 1000).toString()
      );
    }

    if (!result.allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Try again in ${Math.ceil(result.resetTime / 1000)} seconds.`,
      });
    }
  }

  return next();
});

// Search rate limiting middleware
const searchRateLimit = t.middleware(async ({ ctx, next }) => {
  const identifier = getRateLimitIdentifier(
    ctx.session?.user?.id,
    ctx.req?.headers['x-forwarded-for'] || ctx.req?.headers['x-real-ip'] || 'unknown'
  );

  if (!isTrustedSource(identifier)) {
    const result = rateLimiter.checkLimit(identifier, RateLimitConfigs.SEARCH);

    if (ctx.res) {
      ctx.res.setHeader('X-RateLimit-Limit', result.limit.toString());
      ctx.res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      ctx.res.setHeader(
        'X-RateLimit-Reset',
        Math.ceil((Date.now() + result.resetTime) / 1000).toString()
      );
    }

    if (!result.allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Search rate limit exceeded. Try again in ${Math.ceil(result.resetTime / 1000)} seconds.`,
      });
    }
  }

  return next();
});

// Write rate limiting middleware
const writeRateLimit = t.middleware(async ({ ctx, next }) => {
  const identifier = getRateLimitIdentifier(
    ctx.session?.user?.id,
    ctx.req?.headers['x-forwarded-for'] || ctx.req?.headers['x-real-ip'] || 'unknown'
  );

  if (!isTrustedSource(identifier)) {
    const result = rateLimiter.checkLimit(identifier, RateLimitConfigs.WRITE);

    if (ctx.res) {
      ctx.res.setHeader('X-RateLimit-Limit', result.limit.toString());
      ctx.res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      ctx.res.setHeader(
        'X-RateLimit-Reset',
        Math.ceil((Date.now() + result.resetTime) / 1000).toString()
      );
    }

    if (!result.allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Write rate limit exceeded. Try again in ${Math.ceil(result.resetTime / 1000)} seconds.`,
      });
    }
  }

  return next();
});

// Rate limited procedure variants
export const rateLimitedProcedure = publicProcedure.use(generalRateLimit);
export const searchProcedure = publicProcedure.use(searchRateLimit);
export const writeProcedure = protectedProcedure.use(writeRateLimit);

// Create router
export const createRouter = t.router;

// Export router types for convenience
export type Router = ReturnType<typeof createRouter>;

// Export middleware creator for custom middleware
export const middleware = t.middleware;
