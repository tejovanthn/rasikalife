import type { CreateAWSLambdaContextOptions } from '@trpc/server/adapters/aws-lambda';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import { ApplicationError } from '../../core/src/constants';
import type { User } from '@rasika/core';

// Context type with optional user from JWT verification
export interface Context {
  event: APIGatewayProxyEventV2;
  user: User.User | null;
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    const isAppError = error.cause instanceof ApplicationError;

    return {
      ...shape,
      data: {
        ...shape.data,
        code: isAppError ? error.cause.code : undefined,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure that requires authenticated user
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const createTRPCRouter = router;
export const createCallerFactory = t.createCallerFactory;
